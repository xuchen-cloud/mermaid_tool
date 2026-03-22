export const OFFICIAL_MERMAID_THEMES = ["default", "neutral", "dark", "forest", "base"];

const DEFAULT_FONT_FAMILY =
  "Trebuchet MS, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif";

const DEFAULT_THEME_PRESETS = {
  default: {
    canvas: {
      background: "FFFFFF",
      previewBackground: "#ffffff"
    },
    flowchart: {
      node: {
        fill: "ECECFF",
        stroke: "9370DB",
        strokeWidth: 1.25,
        textColor: "333333",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      edge: {
        stroke: "333333",
        strokeWidth: 1.75
      },
      edgeLabel: {
        fill: "E8E8E8",
        textColor: "333333",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      layout: {
        nodeSpacing: 28,
        rankSpacing: 54,
        padding: 8
      }
    },
    sequence: {
      header: {
        fill: "ECECFF",
        stroke: "9370DB",
        strokeWidth: 1.2,
        textColor: "333333",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      lifeline: {
        stroke: "666666",
        strokeWidth: 1.1,
        dashType: "dash"
      },
      message: {
        stroke: "333333",
        strokeWidth: 1.5,
        textColor: "333333",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      note: {
        fill: "FFF8C4",
        stroke: "C3B260",
        strokeWidth: 1,
        textColor: "333333",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      activation: {
        fill: "DDD9FF",
        stroke: "9370DB",
        strokeWidth: 1
      },
      fragment: {
        fill: "FFFFFF",
        stroke: "9A9A9A",
        strokeWidth: 1.1,
        textColor: "333333",
        fontSize: 13,
        fontFamily: "Trebuchet MS"
      }
    }
  },
  neutral: {
    canvas: {
      background: "FFFFFF",
      previewBackground: "#ffffff"
    },
    flowchart: {
      node: {
        fill: "F4F4F4",
        stroke: "666666",
        strokeWidth: 1.2,
        textColor: "222222",
        fontSize: 18,
        fontFamily: "Arial"
      },
      edge: {
        stroke: "666666",
        strokeWidth: 1.5
      },
      edgeLabel: {
        fill: "EEEEEE",
        textColor: "222222",
        fontSize: 14,
        fontFamily: "Arial"
      },
      layout: {
        nodeSpacing: 28,
        rankSpacing: 54,
        padding: 8
      }
    },
    sequence: {
      header: {
        fill: "F4F4F4",
        stroke: "666666",
        strokeWidth: 1.2,
        textColor: "222222",
        fontSize: 18,
        fontFamily: "Arial"
      },
      lifeline: {
        stroke: "999999",
        strokeWidth: 1,
        dashType: "dash"
      },
      message: {
        stroke: "666666",
        strokeWidth: 1.5,
        textColor: "222222",
        fontSize: 14,
        fontFamily: "Arial"
      },
      note: {
        fill: "FFF6C2",
        stroke: "B5A65A",
        strokeWidth: 1,
        textColor: "222222",
        fontSize: 14,
        fontFamily: "Arial"
      },
      activation: {
        fill: "EBEBEB",
        stroke: "666666",
        strokeWidth: 1
      },
      fragment: {
        fill: "FFFFFF",
        stroke: "999999",
        strokeWidth: 1.1,
        textColor: "222222",
        fontSize: 13,
        fontFamily: "Arial"
      }
    }
  },
  dark: {
    canvas: {
      background: "1F2023",
      previewBackground: "#1F2023"
    },
    flowchart: {
      node: {
        fill: "2D2F36",
        stroke: "8A90A5",
        strokeWidth: 1.25,
        textColor: "ECECEE",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      edge: {
        stroke: "C7CBD6",
        strokeWidth: 1.75
      },
      edgeLabel: {
        fill: "3A3D45",
        textColor: "ECECEE",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      layout: {
        nodeSpacing: 28,
        rankSpacing: 54,
        padding: 8
      }
    },
    sequence: {
      header: {
        fill: "2D2F36",
        stroke: "8A90A5",
        strokeWidth: 1.2,
        textColor: "ECECEE",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      lifeline: {
        stroke: "8A90A5",
        strokeWidth: 1.1,
        dashType: "dash"
      },
      message: {
        stroke: "D8DBE5",
        strokeWidth: 1.5,
        textColor: "ECECEE",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      note: {
        fill: "4C4A24",
        stroke: "B8A84F",
        strokeWidth: 1,
        textColor: "F6F2CE",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      activation: {
        fill: "3A3D45",
        stroke: "8A90A5",
        strokeWidth: 1
      },
      fragment: {
        fill: "1F2023",
        stroke: "8A90A5",
        strokeWidth: 1.1,
        textColor: "ECECEE",
        fontSize: 13,
        fontFamily: "Trebuchet MS"
      }
    }
  },
  forest: {
    canvas: {
      background: "F9FBF7",
      previewBackground: "#F9FBF7"
    },
    flowchart: {
      node: {
        fill: "E7F3E8",
        stroke: "52734D",
        strokeWidth: 1.25,
        textColor: "223322",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      edge: {
        stroke: "52734D",
        strokeWidth: 1.6
      },
      edgeLabel: {
        fill: "F0F7F1",
        textColor: "223322",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      layout: {
        nodeSpacing: 28,
        rankSpacing: 54,
        padding: 8
      }
    },
    sequence: {
      header: {
        fill: "E7F3E8",
        stroke: "52734D",
        strokeWidth: 1.2,
        textColor: "223322",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      lifeline: {
        stroke: "6C8A67",
        strokeWidth: 1.1,
        dashType: "dash"
      },
      message: {
        stroke: "355E3B",
        strokeWidth: 1.5,
        textColor: "223322",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      note: {
        fill: "F8F4C5",
        stroke: "A0914A",
        strokeWidth: 1,
        textColor: "223322",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      activation: {
        fill: "DCE9D8",
        stroke: "52734D",
        strokeWidth: 1
      },
      fragment: {
        fill: "F9FBF7",
        stroke: "6C8A67",
        strokeWidth: 1.1,
        textColor: "223322",
        fontSize: 13,
        fontFamily: "Trebuchet MS"
      }
    }
  },
  base: {
    canvas: {
      background: "FFFFFF",
      previewBackground: "#ffffff"
    },
    flowchart: {
      node: {
        fill: "EAF0FF",
        stroke: "5B7FFF",
        strokeWidth: 1.25,
        textColor: "1E2A4A",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      edge: {
        stroke: "5B7FFF",
        strokeWidth: 1.6
      },
      edgeLabel: {
        fill: "EEF3FF",
        textColor: "1E2A4A",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      layout: {
        nodeSpacing: 28,
        rankSpacing: 54,
        padding: 8
      }
    },
    sequence: {
      header: {
        fill: "EAF0FF",
        stroke: "5B7FFF",
        strokeWidth: 1.2,
        textColor: "1E2A4A",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      lifeline: {
        stroke: "8EA2E8",
        strokeWidth: 1.1,
        dashType: "dash"
      },
      message: {
        stroke: "3459D1",
        strokeWidth: 1.5,
        textColor: "1E2A4A",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      note: {
        fill: "FFF6C8",
        stroke: "A9984A",
        strokeWidth: 1,
        textColor: "1E2A4A",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      },
      activation: {
        fill: "DCE6FF",
        stroke: "5B7FFF",
        strokeWidth: 1
      },
      fragment: {
        fill: "FFFFFF",
        stroke: "8EA2E8",
        strokeWidth: 1.1,
        textColor: "1E2A4A",
        fontSize: 13,
        fontFamily: "Trebuchet MS"
      }
    }
  }
};

export function createDefaultMermaidConfig(theme = "default") {
  return {
    theme,
    fontFamily: DEFAULT_FONT_FAMILY,
    securityLevel: "loose",
    flowchart: {
      htmlLabels: false,
      curve: "basis",
      nodeSpacing: 40,
      rankSpacing: 50,
      padding: 12
    },
    themeVariables: {
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: "16px",
      lineColor: "#666666",
      primaryTextColor: "#222222"
    }
  };
}

export function parseMermaidConfigText(text) {
  return JSON.parse(text);
}

export function normalizeMermaidConfig(input = {}) {
  const defaults = createDefaultMermaidConfig(resolveOfficialTheme(input.theme));
  const merged = deepMerge(defaults, input);
  const theme = resolveOfficialTheme(merged.theme);
  const htmlLabels =
    typeof merged.htmlLabels === "boolean"
      ? merged.htmlLabels
      : typeof merged.flowchart?.htmlLabels === "boolean"
        ? merged.flowchart.htmlLabels
        : defaults.flowchart.htmlLabels;

  return {
    ...merged,
    startOnLoad: false,
    suppressErrorRendering: true,
    securityLevel: merged.securityLevel || "loose",
    theme,
    fontFamily: merged.fontFamily || merged.themeVariables?.fontFamily || DEFAULT_FONT_FAMILY,
    htmlLabels,
    flowchart: {
      ...(merged.flowchart || {}),
      htmlLabels
    },
    themeVariables: {
      ...(merged.themeVariables || {}),
      fontFamily:
        merged.themeVariables?.fontFamily || merged.fontFamily || DEFAULT_FONT_FAMILY
    }
  };
}

export function stringifyMermaidConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function resolveOfficialTheme(theme) {
  return OFFICIAL_MERMAID_THEMES.includes(theme) ? theme : "default";
}

export function buildPptThemeFromMermaidConfig(config) {
  const normalized = normalizeMermaidConfig(config);
  const preset = structuredClone(DEFAULT_THEME_PRESETS[normalized.theme]);
  const themeVariables = normalized.themeVariables || {};
  const fontFamily = stripFontFamily(normalized.fontFamily || themeVariables.fontFamily) || preset.flowchart.node.fontFamily;
  const fontSize = parseFontSize(themeVariables.fontSize, 16);
  const lineColor = colorHex(themeVariables.lineColor, preset.flowchart.edge.stroke);
  const primaryColor = colorHex(
    themeVariables.primaryColor || themeVariables.mainBkg,
    preset.flowchart.node.fill
  );
  const primaryBorderColor = colorHex(
    themeVariables.primaryBorderColor || themeVariables.primaryColor,
    preset.flowchart.node.stroke
  );
  const primaryTextColor = colorHex(
    themeVariables.primaryTextColor || themeVariables.textColor,
    preset.flowchart.node.textColor
  );
  const secondaryColor = colorHex(themeVariables.secondaryColor, preset.flowchart.edgeLabel.fill);
  const noteFill = colorHex(
    themeVariables.noteBkgColor || themeVariables.noteBackgroundColor,
    preset.sequence.note.fill
  );
  const noteBorder = colorHex(themeVariables.noteBorderColor, preset.sequence.note.stroke);
  const noteText = colorHex(themeVariables.noteTextColor || themeVariables.primaryTextColor, preset.sequence.note.textColor);
  const canvasBackground = colorHex(
    themeVariables.background || themeVariables.backgroundColor,
    preset.canvas.background
  );
  const actorFill = colorHex(themeVariables.actorBkg, preset.sequence.header.fill);
  const actorBorder = colorHex(themeVariables.actorBorder, preset.sequence.header.stroke);
  const actorText = colorHex(themeVariables.actorTextColor || themeVariables.primaryTextColor, preset.sequence.header.textColor);
  const activationFill = colorHex(themeVariables.activationBkgColor, preset.sequence.activation.fill);
  const activationBorder = colorHex(themeVariables.activationBorderColor, preset.sequence.activation.stroke);
  const fragmentStroke = colorHex(
    themeVariables.altBorderColor || themeVariables.lineColor,
    preset.sequence.fragment.stroke
  );
  const fragmentFill = colorHex(
    themeVariables.altBackground || themeVariables.secondaryColor,
    preset.sequence.fragment.fill
  );

  return {
    canvas: {
      background: canvasBackground,
      previewBackground: colorHex(preset.canvas.previewBackground, canvasBackground)
    },
    flowchart: {
      node: {
        ...preset.flowchart.node,
        fill: primaryColor,
        stroke: primaryBorderColor,
        textColor: primaryTextColor,
        fontSize: fontSize + 2,
        fontFamily
      },
      edge: {
        ...preset.flowchart.edge,
        stroke: lineColor
      },
      edgeLabel: {
        ...preset.flowchart.edgeLabel,
        fill: secondaryColor,
        textColor: primaryTextColor,
        fontSize: Math.max(12, fontSize - 2),
        fontFamily
      },
      layout: {
        nodeSpacing: Math.max(20, Number(normalized.flowchart?.nodeSpacing) || preset.flowchart.layout.nodeSpacing),
        rankSpacing: Math.max(28, Number(normalized.flowchart?.rankSpacing) || preset.flowchart.layout.rankSpacing),
        padding: Math.max(4, Number(normalized.flowchart?.padding) || preset.flowchart.layout.padding)
      }
    },
    sequence: {
      header: {
        ...preset.sequence.header,
        fill: actorFill,
        stroke: actorBorder,
        textColor: actorText,
        fontSize: fontSize + 2,
        fontFamily
      },
      lifeline: {
        ...preset.sequence.lifeline,
        stroke: colorHex(themeVariables.lineColor, preset.sequence.lifeline.stroke)
      },
      message: {
        ...preset.sequence.message,
        stroke: lineColor,
        textColor: primaryTextColor,
        fontSize,
        fontFamily
      },
      note: {
        ...preset.sequence.note,
        fill: noteFill,
        stroke: noteBorder,
        textColor: noteText,
        fontSize,
        fontFamily
      },
      activation: {
        ...preset.sequence.activation,
        fill: activationFill,
        stroke: activationBorder
      },
      fragment: {
        ...preset.sequence.fragment,
        fill: fragmentFill,
        stroke: fragmentStroke,
        textColor: primaryTextColor,
        fontSize: Math.max(12, fontSize - 2),
        fontFamily
      }
    }
  };
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? structuredClone(base) : structuredClone(override);
  }

  const result = structuredClone(base);

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = structuredClone(value);
    }
  }

  return result;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function parseFontSize(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function colorHex(value, fallback) {
  const normalizedFallback = fallback?.replace?.("#", "") || "333333";

  if (!value) {
    return normalizedFallback.toUpperCase();
  }

  if (typeof value !== "string") {
    return normalizedFallback.toUpperCase();
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("#")) {
    return trimmed.slice(1).toUpperCase();
  }

  const rgbMatch = trimmed.match(/rgba?\(([^)]+)\)/i);

  if (!rgbMatch) {
    return normalizedFallback.toUpperCase();
  }

  const channels = rgbMatch[1]
    .split(",")
    .slice(0, 3)
    .map((item) => Number.parseInt(item.trim(), 10));

  if (channels.some((channel) => !Number.isFinite(channel))) {
    return normalizedFallback.toUpperCase();
  }

  return channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function stripFontFamily(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.replace(/"/g, "").split(",")[0].trim();
}
