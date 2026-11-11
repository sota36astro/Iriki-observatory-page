# Usage:
#   gnuplot -c mkplot_optcam.gp INPUT_FILE [OUTPUT_FILE] [HOURS]
#
# Example:
#   gnuplot -c mkplot_optcam.gp temperature.log temperature.png 24

if (!exists("ARG1") || strlen(ARG1) == 0) {
    print "Usage: gnuplot -c mkplot_optcam.gp INPUT_FILE [OUTPUT_FILE] [HOURS]"
    exit
}

datafile = ARG1
outfile = (exists("ARG2") && strlen(ARG2) > 0) ? ARG2 : "OPTCAM_tmp_plot.png"
hours = (exists("ARG3") && strlen(ARG3) > 0) ? real(ARG3) : 24.0

if (hours <= 0) {
    print "Error: HOURS must be greater than zero."
    exit
}

date_time = "%Y/%m/%d %H:%M:%S"

# Use the newest timestamp in the log as the right edge of the graph.
stats datafile using \
    (strptime(date_time, stringcolumn(1)." ".stringcolumn(2))) \
    nooutput

latest_time = STATS_max
start_time = latest_time - hours * 3600

# Include both setting and measured temperatures for both detectors.
temperature_min = 1e100
temperature_max = -1e100
do for [temperature_column in "3 4 8 9"] {
    stats datafile using \
        (strptime(date_time, stringcolumn(1)." ".stringcolumn(2)) >= start_time ? column(int(temperature_column)) : 1/0) \
        nooutput
    temperature_min = (STATS_min < temperature_min) ? STATS_min : temperature_min
    temperature_max = (STATS_max > temperature_max) ? STATS_max : temperature_max
}
temperature_span = temperature_max - temperature_min

# Add 10% padding. For constant data, use 10% of its value or 1 degree at zero.
temperature_padding = (temperature_span > 0) \
    ? temperature_span * 0.1 \
    : ((abs(temperature_max) > 0) ? abs(temperature_max) * 0.1 : 1.0)

set xrange [start_time:latest_time]
set yrange [temperature_min - temperature_padding: \
            temperature_max + temperature_padding]

set encoding utf8
set terminal pngcairo enhanced size 800,600
set output outfile


set xlabel "Time" font "Sans ,15"
set ylabel "Temperature" font "Sans ,15"

set xdata time
set format x "%m/%d\n%H:%M"
set xtics font "Sans ,15" 
set ytics font "Sans ,15"
set grid
set key inside Left reverse top left font "Sans, 17"

# Columns 3/4 are g; columns 8/9 are i. Each detector has three status fields.
plot datafile using \
    (strptime(date_time, stringcolumn(1)." ".stringcolumn(2))):3 \
    with lines linewidth 2 dashtype 2 linecolor rgb "#0072B2" title "g Setting", \
    datafile using \
    (strptime(date_time, stringcolumn(1)." ".stringcolumn(2))):4 \
    with lines linewidth 2 linecolor rgb "#0072B2" title "g Measured Temperature", \
    datafile using \
    (strptime(date_time, stringcolumn(1)." ".stringcolumn(2))):8 \
    with lines linewidth 2 dashtype 2 linecolor rgb "#D55E00" title "i Setting", \
    datafile using \
    (strptime(date_time, stringcolumn(1)." ".stringcolumn(2))):9 \
    with lines linewidth 2 linecolor rgb "#D55E00" title "i Measured Temperature"

unset output
print sprintf("Created: %s", outfile)
