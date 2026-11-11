#!/usr/bin/env bash

set -euo pipefail

usage() {
    echo "Usage: $0 LOG_FILE [HOURS]" >&2
    echo "Example: $0 log_260720 24" >&2
}

if (( $# < 1 || $# > 2 )); then
    usage
    exit 2
fi

log_file=$1
hours=${2:-24}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
plot_file="${script_dir}/KOspec_tmp_plot.png"
json_file="${script_dir}/KOspec_latest.json"

ssh_key="/home/pi/.ssh/id_ed25519_irsf"
ssh_port="30022"
remote_user="skycamera"
remote_host="irsf.sci.kagoshima-u.ac.jp"
remote_dir="/home/skycamera/public_html/obsstatus/plot/"
remote_destination="${remote_user}@${remote_host}:${remote_dir}"

if [[ ! -f "$log_file" ]]; then
    echo "Error: log file not found: $log_file" >&2
    exit 1
fi

if [[ ! -f "$ssh_key" ]]; then
    echo "Error: SSH private key not found: $ssh_key" >&2
    exit 1
fi

gnuplot -c "${script_dir}/mkplot.gp" "$log_file" "$plot_file" "$hours"

python3 - "$log_file" "$json_file" <<'PY'
import datetime
import json
import math
import pathlib
import sys

latest = None
with open(sys.argv[1], encoding="utf-8") as log:
    for line_number, line in enumerate(log, 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        try:
            fields = line.split()
            timestamp = datetime.datetime.strptime(
                f"{fields[0]} {fields[1]}", "%Y/%m/%d %H:%M:%S"
            )
            setting, measured = float(fields[2]), float(fields[3])
            if not all(math.isfinite(value) for value in (setting, measured)):
                raise ValueError("non-finite temperature")
        except (IndexError, ValueError) as error:
            sys.exit(f"Error: invalid log entry at line {line_number}: {error}")
        if latest is None or timestamp >= latest[0]:
            latest = (timestamp, setting, measured)

if latest is None:
    sys.exit("Error: no temperature readings in log")

data = {
    "timestamp": latest[0].isoformat(),
    "setting_temperature": latest[1],
    "measured_temperature": latest[2],
}
pathlib.Path(sys.argv[2]).write_text(
    json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8"
)
PY

scp -i "$ssh_key" -P "$ssh_port" -- "$plot_file" "$json_file" "$remote_destination"

echo "Transferred: $plot_file, $json_file -> $remote_destination ($(date '+%Y-%m-%d %H:%M:%S'))"
