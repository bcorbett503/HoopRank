import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

class HoopRankGraph extends StatelessWidget {
  final List<FlSpot> spots;
  final double minY;
  final double maxY;

  const HoopRankGraph({
    super.key,
    required this.spots,
    this.minY = 1.0,
    this.maxY = 5.0,
  });

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.70,
      child: Padding(
        padding: const EdgeInsets.only(
          right: 18,
          left: 12,
          top: 24,
          bottom: 12,
        ),
        child: LineChart(
          mainData(),
        ),
      ),
    );
  }

  LineChartData mainData() {
    return LineChartData(
      gridData: FlGridData(
        show: true,
        drawVerticalLine: true,
        horizontalInterval: 1,
        verticalInterval: 1,
        getDrawingHorizontalLine: (value) {
          return const FlLine(
            color: Colors.white10,
            strokeWidth: 1,
          );
        },
        getDrawingVerticalLine: (value) {
          return const FlLine(
            color: Colors.white10,
            strokeWidth: 1,
          );
        },
      ),
      titlesData: FlTitlesData(
        show: true,
        rightTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        topTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 30,
            interval: 1,
            getTitlesWidget: bottomTitleWidgets,
          ),
        ),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            interval: 1,
            getTitlesWidget: leftTitleWidgets,
            reservedSize: 42,
          ),
        ),
      ),
      borderData: FlBorderData(
        show: true,
        border: Border.all(color: const Color(0xff37434d)),
      ),
      minX: 0,
      maxX: (spots.length - 1).toDouble(),
      minY: minY,
      maxY: maxY,
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          gradient: const LinearGradient(
            colors: [
              Color(0xFF23b6e6),
              Color(0xFF02d39a),
            ],
          ),
          barWidth: 5,
          isStrokeCapRound: true,
          dotData: const FlDotData(
            show: false,
          ),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              colors: [
                const Color(0xFF23b6e6).withOpacity(0.3),
                const Color(0xFF02d39a).withOpacity(0.3),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget bottomTitleWidgets(double value, TitleMeta meta) {
    const style = TextStyle(
      fontWeight: FontWeight.bold,
      fontSize: 12,
      color: Colors.grey,
    );
    Widget text;
    // Assuming monthly data points for 3 months (0, 1, 2, 3)
    // 0 = 3 months ago, 1 = 2 months ago, 2 = 1 month ago, 3 = Now
    switch (value.toInt()) {
      case 0:
        text = const Text('3M ago', style: style);
        break;
      case 1:
        text = const Text('2M ago', style: style);
        break;
      case 2:
        text = const Text('1M ago', style: style);
        break;
      case 3:
        text = const Text('Now', style: style);
        break;
      default:
        text = const Text('', style: style);
        break;
    }

    return SideTitleWidget(
      axisSide: meta.axisSide,
      child: text,
    );
  }

  Widget leftTitleWidgets(double value, TitleMeta meta) {
    const style = TextStyle(
      fontWeight: FontWeight.bold,
      fontSize: 15,
      color: Colors.grey,
    );
    String text;
    if (value == 1 || value == 2 || value == 3 || value == 4 || value == 5) {
        text = value.toInt().toString();
    } else {
        return Container();
    }

    return Text(text, style: style, textAlign: TextAlign.left);
  }
}
