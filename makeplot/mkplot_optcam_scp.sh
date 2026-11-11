#!/usr/bin/env bash

set -euo pipefail

usage() {
    echo "Usage: $0 LOG_FILE [HOURS]" >&2
    echo "Example: $0 optcam_log_261031 24" >&2
    echo "Override SSH key: SSH_KEY=/path/to/private_key $0 LOG_FILE [HOURS]" >&2
}

if (( $# < 1 || $# > 2 )); then
    usage
    exit 2
fi

log_file=$1
hours=${2:-24}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
plot_file="${script_dir}/OPTCAM_tmp_plot.png"
json_file="${script_dir}/OPTCAM_latest.json"

ssh_key="${SSH_KEY:-/home/pi/.ssh/id_ed25519_irsf}"
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
    echo "Set SSH_KEY to the existing private key used for the transfer server." >&2
    exit 1
fi

clean_log=$(mktemp)
trap 'rm -f -- "$clean_log"' EXIT

python3 - "$log_file" "$json_file" "$clean_log" <<'PY'
import datetime
import json
import math
import pathlib
import sys

# Columns: date time g_set g_measured g_status(3) i_set i_measured i_status(3)
latest = None
skipped = 0
first_skipped = None
cleaned_nul_lines = 0
with open(sys.argv[1], encoding="utf-8", errors="replace") as log, open(
    sys.argv[3], "w", encoding="utf-8"
) as cleaned:
    for line_number, line in enumerate(log, 1):
        # NUL padding can precede an otherwise complete reading.
        if line.startswith("\x00"):
            line = line.lstrip("\x00")
            cleaned_nul_lines += 1
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        try:
            if "\x00" in line or "\ufffd" in line:
                raise ValueError("corrupt log entry")
            fields = line.split()
            timestamp = datetime.datetime.strptime(
                f"{fields[0]} {fields[1]}", "%Y/%m/%d %H:%M:%S"
            )
            if len(fields) != 12:
                raise ValueError("expected 12 columns for g and i detectors")
            temperatures = tuple(float(fields[index]) for index in (2, 3, 7, 8))
            if not all(math.isfinite(value) for value in temperatures):
                raise ValueError("non-finite temperature")
        except (IndexError, ValueError):
            skipped += 1
            if first_skipped is None:
                first_skipped = line_number
            continue
        cleaned.write(" ".join(fields) + "\n")
        if latest is None or timestamp >= latest[0]:
            latest = (timestamp, *temperatures)

if cleaned_nul_lines:
    print(f"Warning: removed leading NUL padding from {cleaned_nul_lines} line(s).", file=sys.stderr)
if skipped:
    print(
        f"Warning: skipped {skipped} incomplete/invalid log line(s) "
        f"(first at line {first_skipped}).",
        file=sys.stderr,
    )
if latest is None:
    sys.exit("Error: no complete valid g/i temperature readings in log")

data = {
    "timestamp": latest[0].isoformat(),
    "g": {
        "setting_temperature": latest[1],
        "measured_temperature": latest[2],
    },
    "i": {
        "setting_temperature": latest[3],
        "measured_temperature": latest[4],
    },
}
pathlib.Path(sys.argv[2]).write_text(
    json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8"
)
print(f"Latest valid reading: {data['timestamp']}")
PY

gnuplot -c "${script_dir}/mkplot_optcam.gp" "$clean_log" "$plot_file" "$hours"

scp -i "$ssh_key" -P "$ssh_port" -- "$plot_file" "$json_file" "$remote_destination"

echo "Transferred: $plot_file, $json_file -> $remote_destination ($(date '+%Y-%m-%d %H:%M:%S'))"
