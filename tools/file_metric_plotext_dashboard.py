#!/usr/bin/env python3

import argparse
import math
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, TextIO, Tuple

try:
    import plotext as plt
except ImportError as exc:
    raise SystemExit(
        "plotext is required. Install with: python3 -m pip install plotext"
    ) from exc


TIMESTAMP_FORMAT = "%a %b %d %H:%M:%S %Y"
VALUE_REGEX = re.compile(
    r"^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*?)\s*$"
)
RANK_REGEX = re.compile("Rank ?[0-9]+")


@dataclass
class MetricSeries:
    time: List[datetime] = field(default_factory=list)
    value: List[float] = field(default_factory=list)
    units: Set[str] = field(default_factory=set)

    def append(
        self, timestamp: datetime, value: float, unit: str, data_retention_limit: int
    ) -> None:
        self.time.append(timestamp)
        self.value.append(value)
        self.units.add(unit)
        if data_retention_limit > 0 and len(self.time) > data_retention_limit:
            keep_from = len(self.time) - data_retention_limit
            self.time = self.time[keep_from:]
            self.value = self.value[keep_from:]


@dataclass
class FollowState:
    path: str
    stream: Optional[TextIO] = None
    inode: Optional[int] = None
    initialized: bool = False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Follow FileMetric output and show a real-time terminal dashboard."
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        help="FileMetric input file(s) or directory path(s).",
    )
    parser.add_argument(
        "--input",
        action="append",
        dest="input_opt",
        help="Input FileMetric file or directory. May be specified multiple times.",
    )
    parser.add_argument(
        "--plot",
        action="append",
        dest="plot_opt",
        help="Grouped plot name to display (suffix after final '.'). May be specified multiple times.",
    )
    parser.add_argument(
        "--plot-regex",
        dest="plot_regex",
        help="Regular expression used to select grouped plot names.",
    )
    parser.add_argument(
        "--list-plots",
        action="store_true",
        help="Print available grouped plot names and exit.",
    )
    parser.add_argument(
        "--from-start",
        action="store_true",
        help="Read existing file contents on startup (default starts at end, like tail -f).",
    )
    parser.add_argument(
        "--refresh-seconds",
        type=float,
        default=1.0,
        help="Dashboard refresh interval in seconds (default: 1.0).",
    )
    parser.add_argument(
        "--max-points",
        type=int,
        default=120,
        help="Maximum points kept per metric trace (default: 120).",
    )
    parser.add_argument(
        "--columns",
        type=int,
        default=2,
        help="Maximum subplot columns for dashboard layout (default: 2).",
    )
    parser.add_argument(
        "--x-ticks",
        type=int,
        default=12,
        help="Target number of x-axis tick labels per subplot (default: 12).",
    )
    return parser.parse_args()


def parse_line(line: str) -> Optional[Tuple[datetime, str, float, str]]:
    marker = ": FileMetric: "
    if marker not in line:
        return None

    timestamp_text, metric_text = line.split(marker, 1)
    timestamp_text = timestamp_text.strip()

    if ": " not in metric_text:
        return None

    metric_name, value_with_unit = metric_text.rsplit(": ", 1)
    metric_name = metric_name.strip()
    value_with_unit = value_with_unit.strip()
    if value_with_unit.endswith("."):
        value_with_unit = value_with_unit[:-1].rstrip()

    value_match = VALUE_REGEX.match(value_with_unit)
    if value_match is None:
        return None

    value = float(value_match.group(1))
    unit = value_match.group(2).strip()

    try:
        timestamp = datetime.strptime(timestamp_text, TIMESTAMP_FORMAT)
    except ValueError:
        return None

    return timestamp, metric_name, value, unit


def extract_metric_group_name(metric_name: str) -> str:
    rank_normalized_name = RANK_REGEX.sub("Rank N", metric_name)
    if "." in rank_normalized_name:
        return rank_normalized_name.rsplit(".", 1)[-1]
    return rank_normalized_name


def expand_input_specs(input_specs: Iterable[str]) -> List[str]:
    input_paths: List[str] = []
    seen = set()
    for input_spec in input_specs:
        try:
            resolved_input = Path(input_spec).resolve(strict=True)
        except OSError as exc:
            raise SystemExit(
                f"Unable to access input path '{input_spec}': {exc}"
            ) from exc
        if resolved_input.is_dir():
            for entry in sorted(resolved_input.iterdir()):
                if not entry.is_file():
                    continue
                resolved_entry_path = str(entry.resolve())
                if resolved_entry_path in seen:
                    continue
                input_paths.append(resolved_entry_path)
                seen.add(resolved_entry_path)
        elif resolved_input.is_file():
            resolved_path = str(resolved_input)
            if resolved_path in seen:
                continue
            input_paths.append(resolved_path)
            seen.add(resolved_path)
    return input_paths


def resolve_input_paths(args: argparse.Namespace) -> List[str]:
    input_specs: List[str] = list(args.input_opt or [])
    input_specs.extend(args.inputs)
    if not input_specs:
        raise SystemExit("Provide one or more input file/directory paths.")
    input_paths = expand_input_specs(input_specs)
    if not input_paths:
        raise SystemExit("No readable input files found from provided input path(s).")
    return input_paths


def ensure_stream(state: FollowState, from_start: bool) -> bool:
    try:
        stat_result = os.stat(state.path)
    except OSError:
        if state.stream is not None:
            state.stream.close()
            state.stream = None
            state.inode = None
            state.initialized = False
        return False

    if state.stream is not None and state.inode == stat_result.st_ino:
        try:
            if state.stream.tell() > stat_result.st_size:
                state.stream.seek(0)
        except OSError:
            pass
        return True

    if state.stream is not None:
        state.stream.close()
    state.stream = open(state.path, "r", encoding="utf-8")
    state.inode = stat_result.st_ino
    if not state.initialized and not from_start:
        state.stream.seek(0, os.SEEK_END)
    state.initialized = True
    return True


def read_new_lines(states: List[FollowState], from_start: bool) -> List[str]:
    lines: List[str] = []
    for state in states:
        if not ensure_stream(state, from_start):
            continue
        assert state.stream is not None
        while True:
            raw_line = state.stream.readline()
            if not raw_line:
                break
            lines.append(raw_line.rstrip("\n"))
    return lines


def update_series(
    grouped_series: Dict[str, Dict[str, MetricSeries]], lines: Iterable[str], max_points: int
) -> None:
    for line in lines:
        parsed = parse_line(line.strip())
        if parsed is None:
            continue
        timestamp, metric_name, value, unit = parsed
        group_name = extract_metric_group_name(metric_name)
        if group_name not in grouped_series:
            grouped_series[group_name] = {}
        if metric_name not in grouped_series[group_name]:
            grouped_series[group_name][metric_name] = MetricSeries()
        grouped_series[group_name][metric_name].append(timestamp, value, unit, max_points)


def select_groups(
    grouped_series: Dict[str, Dict[str, MetricSeries]],
    selected_groups: Optional[Set[str]],
    plot_regex: Optional[re.Pattern[str]],
) -> List[str]:
    groups = sorted(grouped_series)
    if selected_groups:
        groups = [group for group in groups if group in selected_groups]
    if plot_regex is not None:
        groups = [group for group in groups if plot_regex.search(group)]
    return groups


def render_dashboard(
    grouped_series: Dict[str, Dict[str, MetricSeries]],
    groups: List[str],
    columns: int,
    x_tick_count: int,
) -> None:
    plt.clf()
    if not groups:
        plt.clear_terminal()
        print("No selected plots available yet.")
        return

    subplot_columns = columns
    subplot_rows = math.ceil(len(groups) / subplot_columns)
    plt.subplots(subplot_rows, subplot_columns)

    for index, group_name in enumerate(groups):
        row = index // subplot_columns + 1
        column = index % subplot_columns + 1
        plt.subplot(row, column)
        traces = grouped_series[group_name]
        for metric_name in sorted(traces):
            metric_data = traces[metric_name]
            if not metric_data.time:
                continue
            x_labels = [timestamp.strftime("%H:%M:%S") for timestamp in metric_data.time]
            unit = ""
            if len(metric_data.units) == 1:
                unit = next(iter(metric_data.units))
            elif len(metric_data.units) > 1:
                unit = "mixed units"
            trace_label = metric_name if not unit else f"{metric_name} [{unit}]"
            plt.plot(x_labels, metric_data.value, label=trace_label)
        plt.title(group_name)
        plt.xlabel("Time")
        plt.ylabel("Value")
        plt.grid(True, True)
        max_trace_points = max((len(series.time) for series in traces.values()), default=0)
        tick_step = 1
        if max_trace_points > x_tick_count:
            tick_step = math.ceil(max_trace_points / x_tick_count)
        plt.xfrequency(tick_step)
        if len(traces) > 1:
            plt.legend(True)
    plt.show()


def close_streams(states: List[FollowState]) -> None:
    for state in states:
        if state.stream is not None:
            state.stream.close()
            state.stream = None


def main() -> int:
    args = parse_args()
    input_paths = resolve_input_paths(args)

    selected_groups = set(args.plot_opt) if args.plot_opt else None
    plot_regex = re.compile(args.plot_regex) if args.plot_regex else None
    if args.refresh_seconds <= 0:
        raise SystemExit("--refresh-seconds must be greater than 0.")
    if args.max_points <= 0:
        raise SystemExit("--max-points must be greater than 0.")
    if args.columns <= 0:
        raise SystemExit("--columns must be greater than 0.")
    if args.x_ticks <= 0:
        raise SystemExit("--x-ticks must be greater than 0.")

    states = [FollowState(path) for path in input_paths]
    grouped_series: Dict[str, Dict[str, MetricSeries]] = {}

    try:
        initial_lines = read_new_lines(states, args.from_start)
        update_series(grouped_series, initial_lines, args.max_points)

        if args.list_plots:
            groups = select_groups(grouped_series, selected_groups, plot_regex)
            for group in groups:
                print(group)
            return 0

        while True:
            new_lines = read_new_lines(states, args.from_start)
            update_series(grouped_series, new_lines, args.max_points)
            groups = select_groups(grouped_series, selected_groups, plot_regex)
            render_dashboard(grouped_series, groups, args.columns, args.x_ticks)
            time.sleep(args.refresh_seconds)
    except KeyboardInterrupt:
        return 0
    finally:
        close_streams(states)


if __name__ == "__main__":
    raise SystemExit(main())
