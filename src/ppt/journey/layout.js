const TITLE_HEIGHT = 30;
const TITLE_GAP = 14;
const SECTION_HEIGHT = 34;
const TASK_WIDTH = 128;
const TASK_HEIGHT = 56;
const TASK_GAP = 18;
const TOP_PADDING = 24;
const SIDE_PADDING = 26;
const TASK_ROW_Y = 112;
const SCORE_LINE_BOTTOM = 320;
const SCORE_STEP = 26;

const SECTION_FILLS = ["DCE8FF", "DDF4E7", "FFF0D8", "F8DDE4", "E7E2FF", "DDF2F8"];

export function layoutJourney(parsed, theme = {}) {
  const styles = createJourneyStyles(theme);
  const sections = [];
  const tasks = [];
  let cursorX = SIDE_PADDING;

  const sectionOrder = new Map(parsed.sections.map((section) => [section.id, section]));

  for (const section of parsed.sections) {
    const sectionTasks = parsed.tasks.filter((task) => task.sectionId === section.id);
    const sectionX = cursorX;
    const sectionWidth =
      Math.max(1, sectionTasks.length) * TASK_WIDTH + Math.max(0, sectionTasks.length - 1) * TASK_GAP;
    const fill = SECTION_FILLS[sections.length % SECTION_FILLS.length];

    sections.push({
      ...section,
      x: sectionX,
      y: TOP_PADDING + (parsed.title ? TITLE_HEIGHT + TITLE_GAP : 0),
      width: sectionWidth,
      height: SECTION_HEIGHT,
      fill,
      textColor: styles.section.textColor
    });

    for (const task of sectionTasks) {
      const scoreY = SCORE_LINE_BOTTOM - task.score * SCORE_STEP;
      tasks.push({
        ...task,
        x: cursorX,
        y: TASK_ROW_Y + (parsed.title ? TITLE_HEIGHT + TITLE_GAP : 0),
        width: TASK_WIDTH,
        height: TASK_HEIGHT,
        fill,
        textColor: styles.task.textColor,
        scoreLineX: cursorX + TASK_WIDTH / 2,
        scoreLineY1: TASK_ROW_Y + TASK_HEIGHT + (parsed.title ? TITLE_HEIGHT + TITLE_GAP : 0),
        scoreLineY2: SCORE_LINE_BOTTOM + (parsed.title ? TITLE_HEIGHT + TITLE_GAP : 0),
        scoreBubbleY: scoreY + (parsed.title ? TITLE_HEIGHT + TITLE_GAP : 0)
      });
      cursorX += TASK_WIDTH + TASK_GAP;
    }
  }

  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const sectionTasksMap = new Map(sections.map((section) => [section.id, []]));
  for (const task of tasks) {
    sectionTasksMap.get(task.sectionId)?.push(task.id);
  }

  return {
    type: "journey",
    title: parsed.title
      ? {
          text: parsed.title,
          x: SIDE_PADDING,
          y: TOP_PADDING,
          width: Math.max(320, cursorX - SIDE_PADDING),
          height: TITLE_HEIGHT,
          style: {
            textColor: styles.title.textColor,
            fontSize: styles.title.fontSize,
            fontFamily: styles.title.fontFamily
          }
        }
      : null,
    sections: sections.map((section) => ({
      ...section,
      taskIds: sectionTasksMap.get(section.id) ?? []
    })),
    tasks,
    sectionMap,
    sectionOrder,
    theme: {
      canvas: {
        background: styles.canvas.background
      },
      title: styles.title,
      section: styles.section,
      task: styles.task,
      score: styles.score
    },
    canvas: {
      width: Math.max(680, cursorX - TASK_GAP + SIDE_PADDING),
      height: SCORE_LINE_BOTTOM + (parsed.title ? TITLE_HEIGHT + TITLE_GAP : 0) + 48
    }
  };
}

function createJourneyStyles(theme) {
  const background = theme.canvas?.background || "FFFFFF";
  const fontFamily = theme.flowchart?.node?.fontFamily || "Trebuchet MS";
  const textColor = theme.flowchart?.node?.textColor || "333333";

  return {
    canvas: {
      background
    },
    title: {
      textColor,
      fontSize: 20,
      fontFamily
    },
    section: {
      textColor,
      fontSize: 14,
      fontFamily
    },
    task: {
      textColor,
      fontSize: 13,
      fontFamily
    },
    score: {
      fill: theme.flowchart?.node?.stroke || "4F7CF7",
      textColor: "FFFFFF",
      lineColor: theme.flowchart?.edge?.stroke || "666666"
    }
  };
}
