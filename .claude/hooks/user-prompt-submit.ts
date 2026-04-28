import * as fs from 'fs';
import * as path from 'path';

interface SkillRule {
  type: string;
  enforcement: string;
  priority: string;
  description: string;
  promptTriggers: {
    keywords: string[];
    intentPatterns: string[];
  };
  fileTriggers?: {
    pathPatterns: string[];
    contentPatterns: string[];
  };
  criticalReminders?: string[];
}

interface SkillRules {
  [skillName: string]: SkillRule;
}

/**
 * UserPromptSubmit Hook - Auto-activate skills based on context
 *
 * This hook runs BEFORE Claude sees your message and injects
 * skill activation reminders based on:
 * 1. Keywords in your prompt
 * 2. Intent patterns (regex matching)
 * 3. Files in context (path and content patterns)
 */
export default async function userPromptSubmit(
  request: { prompt: string },
  context: {
    cwd: string;
    files?: Array<{ path: string; content?: string }>;
  }
): Promise<{ prompt: string }> {
  try {
    const { prompt } = request;
    const { cwd, files = [] } = context;

    // Load skill rules
    const rulesPath = path.join(cwd, '.claude', 'skill-rules.json');
    if (!fs.existsSync(rulesPath)) {
      return { prompt };
    }

    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    const skillRules: SkillRules = JSON.parse(rulesContent);

    // Detect which skills should be activated
    const activatedSkills = detectSkills(prompt, files, skillRules);

    if (activatedSkills.length === 0) {
      return { prompt };
    }

    // Build skill activation message
    const skillMessages = activatedSkills.map((skill) => {
      const rule = skillRules[skill];
      let message = `📚 **${skill}**\n   ${rule.description}`;

      if (rule.priority === 'critical' && rule.criticalReminders) {
        message += '\n\n' + rule.criticalReminders.map(r => `   ${r}`).join('\n');
      }

      return message;
    });

    const injectedMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following skills are relevant to this task:

${skillMessages.join('\n\n')}

Please reference these skills when implementing the solution.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User Request:
${prompt}`;

    return { prompt: injectedMessage };
  } catch (error) {
    console.error('Error in user-prompt-submit hook:', error);
    return { prompt: request.prompt };
  }
}

/**
 * Detect which skills should be activated based on prompt and context
 */
function detectSkills(
  prompt: string,
  files: Array<{ path: string; content?: string }>,
  skillRules: SkillRules
): string[] {
  const activated = new Set<string>();
  const promptLower = prompt.toLowerCase();

  for (const [skillName, rule] of Object.entries(skillRules)) {
    let score = 0;

    // Check keyword matches
    for (const keyword of rule.promptTriggers.keywords) {
      if (promptLower.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Check intent pattern matches
    for (const pattern of rule.promptTriggers.intentPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(prompt)) {
        score += 2; // Intent patterns are stronger signals
      }
    }

    // Check file path patterns
    if (rule.fileTriggers) {
      for (const file of files) {
        for (const pathPattern of rule.fileTriggers.pathPatterns) {
          if (matchesPattern(file.path, pathPattern)) {
            score += 3; // File context is strong signal
          }
        }

        // Check file content patterns
        if (file.content) {
          for (const contentPattern of rule.fileTriggers.contentPatterns) {
            const regex = new RegExp(contentPattern);
            if (regex.test(file.content)) {
              score += 2;
            }
          }
        }
      }
    }

    // Activate skill if score threshold met
    if (score >= 1) {
      activated.add(skillName);
    }
  }

  // Sort by priority
  return Array.from(activated).sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const aPriority = priorityOrder[skillRules[a].priority as keyof typeof priorityOrder] || 3;
    const bPriority = priorityOrder[skillRules[b].priority as keyof typeof priorityOrder] || 3;
    return aPriority - bPriority;
  });
}

/**
 * Check if a file path matches a glob-like pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Normalize paths
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    .replace(/\*\*/g, '§DOUBLESTAR§')
    .replace(/\*/g, '[^/]*')
    .replace(/§DOUBLESTAR§/g, '.*')
    .replace(/\./g, '\\.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}
