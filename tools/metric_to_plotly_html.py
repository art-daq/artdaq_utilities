#!/usr/bin/env python3

import argparse
import html
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

try:
    import plotly.graph_objects as go
except ImportError as exc:
    raise SystemExit(
        "plotly is required. Install with: python3 -m pip install plotly"
    ) from exc


TIMESTAMP_FORMAT = "%a %b %d %H:%M:%S %Y"
VALUE_REGEX = re.compile(
    r"^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*?)\s*$"
)


@dataclass
class MetricSeries:
    time: List[datetime] = field(default_factory=list)
    value: List[float] = field(default_factory=list)
    units: Set[str] = field(default_factory=set)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert FileMetric output into an HTML page with Plotly plots."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Positional usage: <input ...> <output.html>.",
    )
    parser.add_argument(
        "--input",
        dest="input_opt",
        action="append",
        help="Input FileMetric file or directory. May be specified multiple times.",
    )
    parser.add_argument("--output", dest="output_opt", help="Output HTML file")
    return parser.parse_args()


def resolve_paths(args: argparse.Namespace) -> Tuple[List[str], str]:
    input_specs: List[str] = list(args.input_opt or [])
    output_path = args.output_opt

    if args.paths:
        if output_path is None:
            if len(args.paths) < 2:
                raise SystemExit(
                    "Positional usage requires at least one input and one output path."
                )
            input_specs.extend(args.paths[:-1])
            output_path = args.paths[-1]
        else:
            input_specs.extend(args.paths)

    if not input_specs or output_path is None:
        raise SystemExit(
            "Provide input path(s) and output path using positional form "
            "(input ... output.html), flags (--input ... --output ...), or both."
        )

    input_paths = expand_input_specs(input_specs)
    if not input_paths:
        raise SystemExit("No readable input files found from provided input path(s).")

    return input_paths, output_path


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
                resolved_entry = entry.resolve()
                resolved_entry_text = str(resolved_entry)
                if resolved_entry_text in seen:
                    continue
                input_paths.append(resolved_entry_text)
                seen.add(resolved_entry_text)
        elif resolved_input.is_file():
            resolved_input_text = str(resolved_input)
            if resolved_input_text in seen:
                continue
            input_paths.append(resolved_input_text)
            seen.add(resolved_input_text)
    return input_paths


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


def metric_group(metric_name: str) -> str:
    if "." in metric_name:
        return metric_name.rsplit(".", 1)[-1]
    return metric_name


def build_html(
    grouped_series: Dict[str, Dict[str, MetricSeries]], total_points: int
) -> str:
    if total_points == 0:
        return (
            "<!doctype html><html><head><meta charset='utf-8'>"
            "<title>FileMetric Plotly Plots</title></head><body>"
            "<h1>FileMetric Plotly Plots</h1>"
            "<p>No parseable FileMetric entries were found.</p>"
            "</body></html>"
        )

    page_parts: List[str] = [
        "<!doctype html>",
        "<html><head><meta charset='utf-8'><title>FileMetric Plotly Plots</title></head>",
        "<body>",
        "<h1>FileMetric Plotly Plots</h1>",
    ]

    include_plotly = True
    for group_name in sorted(grouped_series):
        fig = go.Figure()
        traces = grouped_series[group_name]
        for metric_name in sorted(traces):
            metric_data = traces[metric_name]
            unit = ""
            if len(metric_data.units) == 1:
                unit = next(iter(metric_data.units))
            elif len(metric_data.units) > 1:
                unit = "mixed units"
            trace_label = metric_name
            if unit:
                trace_label = f"{metric_name} [{unit}]"
            fig.add_trace(
                go.Scatter(
                    x=metric_data.time,
                    y=metric_data.value,
                    mode="lines+markers",
                    name=trace_label,
                )
            )

        fig.update_layout(
            title=group_name,
            xaxis_title="Timestamp",
            yaxis_title="Value",
            hovermode="x unified",
        )

        page_parts.append(f"<h2>{html.escape(group_name)}</h2>")
        page_parts.append(
            fig.to_html(
                full_html=False,
                include_plotlyjs=include_plotly,
                default_height="500px",
            )
        )
        include_plotly = False

    page_parts.append("</body></html>")
    return "\n".join(page_parts)


def main() -> int:
    args = parse_args()
    input_paths, output_path = resolve_paths(args)

    grouped_series: Dict[str, Dict[str, MetricSeries]] = {}
    total_points = 0

    for input_path in input_paths:
        try:
            with open(input_path, "r", encoding="utf-8") as metric_file:
                for raw_line in metric_file:
                    parsed = parse_line(raw_line.strip())
                    if parsed is None:
                        continue
                    timestamp, metric_name, value, unit = parsed
                    group_name = metric_group(metric_name)
                    if group_name not in grouped_series:
                        grouped_series[group_name] = {}
                    if metric_name not in grouped_series[group_name]:
                        grouped_series[group_name][metric_name] = MetricSeries()
                    grouped_series[group_name][metric_name].time.append(timestamp)
                    grouped_series[group_name][metric_name].value.append(value)
                    grouped_series[group_name][metric_name].units.add(unit)
                    total_points += 1
        except OSError as exc:
            raise SystemExit(
                f"Unable to read input file '{input_path}': {exc}"
            ) from exc
        except UnicodeDecodeError:
            print(
                f"Skipping non-text input file '{input_path}'",
                file=sys.stderr,
            )
            continue

    html_doc = build_html(grouped_series, total_points)

    try:
        with open(output_path, "w", encoding="utf-8") as output_file:
            output_file.write(html_doc)
    except OSError as exc:
        raise SystemExit(f"Unable to write output file '{output_path}': {exc}") from exc

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
