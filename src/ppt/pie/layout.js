const PIE_WIDTH = 760;
const PIE_HEIGHT = 450;
const PIE_RADIUS = 150;
const PIE_CENTER_X = 220;
const PIE_CENTER_Y = 225;
const LEGEND_X = 450;
const LEGEND_Y = 118;
const LEGEND_ROW_HEIGHT = 24;

const DEFAULT_COLORS = [
  "4F7CF7",
  "65B891",
  "F2A65A",
  "D96C75",
  "7A77FF",
  "53A2BE",
  "E76F51",
  "2A9D8F",
  "E9C46A",
  "8D99AE",
  "B56576",
  "6D597A"
];

export function layoutPie(parsed, theme = {}) {
  const styles = createPieStyles(theme);
  const total = parsed.sections.reduce((sum, section) => sum + Math.max(0, section.value), 0);

  if (total <= 0) {
    throw new Error("Pie diagrams require at least one positive section value for PPT export.");
  }

  let startAngle = -Math.PI / 2;
  const sections = parsed.sections.map((section, index) => {
    const ratio = Math.max(0, section.value) / total;
    const angle = ratio * Math.PI * 2;
    const endAngle = startAngle + angle;
    const labelAngle = startAngle + angle / 2;
    const labelRadius = PIE_RADIUS * 0.63;
    const fill = styles.sectionColors[index % styles.sectionColors.length];

    const nextSection = {
      ...section,
      percentage: ratio * 100,
      fill,
      startAngle,
      endAngle,
      labelX: PIE_CENTER_X + Math.cos(labelAngle) * labelRadius,
      labelY: PIE_CENTER_Y + Math.sin(labelAngle) * labelRadius
    };

    startAngle = endAngle;
    return nextSection;
  });

  const legends = sections.map((section, index) => ({
    id: `legend-${section.id}`,
    sectionId: section.id,
    x: LEGEND_X,
    y: LEGEND_Y + index * LEGEND_ROW_HEIGHT,
    width: 220,
    height: 18,
    fill: section.fill,
    text: parsed.showData ? `${section.label} [${section.value}]` : section.label
  }));

  return {
    type: "pie",
    title: parsed.title,
    showData: parsed.showData,
    sections,
    legends,
    centerX: PIE_CENTER_X,
    centerY: PIE_CENTER_Y,
    radius: PIE_RADIUS,
    theme: {
      canvas: {
        background: styles.canvas.background
      },
      title: styles.title,
      legend: styles.legend
    },
    canvas: {
      width: PIE_WIDTH,
      height: PIE_HEIGHT
    }
  };
}

export function getVisiblePieSections(parsedOrDiagram) {
  const sections = [...(parsedOrDiagram.sections ?? [])];
  const total = sections.reduce((sum, section) => sum + Math.max(0, section.value), 0);

  if (total <= 0) {
    return [];
  }

  return sections
    .filter((section) => (Math.max(0, section.value) / total) * 100 >= 1)
    .sort((left, right) => right.value - left.value);
}

function createPieStyles(theme) {
  const background = theme.canvas?.background || "FFFFFF";
  const fontFamily = theme.flowchart?.node?.fontFamily || "Trebuchet MS";
  const titleColor = theme.flowchart?.node?.textColor || "333333";
  const legendColor = theme.flowchart?.edgeLabel?.textColor || titleColor;

  return {
    canvas: {
      background
    },
    title: {
      textColor: titleColor,
      fontSize: 20,
      fontFamily
    },
    legend: {
      textColor: legendColor,
      fontSize: 12,
      fontFamily
    },
    sectionColors: DEFAULT_COLORS
  };
}
