import type { AssistantId, AssistantSkillDefinition } from './types'
import { apiConfigTemplateSkill } from './skills/api-config-template'
import { tutorialSkill } from './skills/tutorial'
import { creativeStudioSkill } from './skills/creative-studio'

const SKILLS: Record<AssistantId, AssistantSkillDefinition> = {
  'api-config-template': apiConfigTemplateSkill,
  tutorial: tutorialSkill,
  'creative-studio': creativeStudioSkill,
}

export function getAssistantSkill(id: AssistantId): AssistantSkillDefinition {
  return SKILLS[id]
}

export function isAssistantId(value: unknown): value is AssistantId {
  return value === 'api-config-template' || value === 'tutorial' || value === 'creative-studio'
}
