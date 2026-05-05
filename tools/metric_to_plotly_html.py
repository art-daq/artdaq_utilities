#!/usr/bin/env python3

import argparse
import html
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

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
        description=(
            "Convert FileMetric output into an HTML page with Plotly plots. "
            "The generated HTML is always written to the output file and stdout."
        )
    )
    parser.add_argument("input_file", nargs="?", help="Input FileMetric output file")
    parser.add_argument(
        "output_file",
        nargs="?",
        help="Output HTML file (HTML is also emitted to stdout)",
    )
    parser.add_argument(
        "--input", dest="input_opt", help="Input FileMetric output file"
    )
    parser.add_argument(
        "--output",
        dest="output_opt",
        help="Output HTML file (HTML is also emitted to stdout)",
    )
    return parser.parse_args()


def resolve_paths(args: argparse.Namespace) -> Tuple[str, str]:
    input_path = args.input_opt or args.input_file
    output_path = args.output_opt or args.output_file

    if input_path is None or output_path is None:
        raise SystemExit(
            "Both input and output are required. Use either positional args "
            "(input output.html) or flags (--input ... --output ...)."
        )

    if args.input_opt and args.input_file and args.input_opt != args.input_file:
        raise SystemExit("Conflicting input paths provided by positional and --input.")
    if args.output_opt and args.output_file and args.output_opt != args.output_file:
        raise SystemExit(
            "Conflicting output paths provided by positional and --output."
        )

    return input_path, output_path


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
    if " - " in metric_name:
        return metric_name.rsplit(" - ", 1)[0]
    if "." in metric_name:
        return metric_name.split(".", 1)[0]
    parts = metric_name.split()
    if len(parts) > 1:
        return parts[0]
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
    input_path, output_path = resolve_paths(args)

    grouped_series: Dict[str, Dict[str, MetricSeries]] = defaultdict(
        lambda: defaultdict(MetricSeries)
    )
    parseable_points = 0

    try:
        with open(input_path, "r", encoding="utf-8") as metric_file:
            for raw_line in metric_file:
                parsed = parse_line(raw_line.strip())
                if parsed is None:
                    continue
                timestamp, metric_name, value, unit = parsed
                group_name = metric_group(metric_name)
                grouped_series[group_name][metric_name].time.append(timestamp)
                grouped_series[group_name][metric_name].value.append(value)
                grouped_series[group_name][metric_name].units.add(unit)
                parseable_points += 1
    except OSError as exc:
        raise SystemExit(f"Unable to read input file '{input_path}': {exc}") from exc

    html_doc = build_html(grouped_series, parseable_points)

    try:
        with open(output_path, "w", encoding="utf-8") as output_file:
            output_file.write(html_doc)
    except OSError as exc:
        raise SystemExit(f"Unable to write output file '{output_path}': {exc}") from exc

    print(html_doc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
