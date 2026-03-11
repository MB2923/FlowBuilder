import { NodeType } from './types';

export type Language = 'en' | 'ru';

export const NODE_TYPE_TEXT: Record<Language, Record<NodeType, { label: string; description: string }>> = {
  en: {
    static: { label: 'Info Card', description: 'Display text or information. No choices.' },
    radio: { label: 'Single Choice', description: 'User must pick exactly one option.' },
    checkbox: { label: 'Multiple Choice', description: 'User can pick multiple options. Complex logic support.' },
    end: { label: 'End Point', description: 'Finishes the flow. Optional restart.' },
  },
  ru: {
    static: { label: 'Инфо-блок', description: 'Показывает текст или информацию без выбора.' },
    radio: { label: 'Один вариант', description: 'Пользователь выбирает только один вариант.' },
    checkbox: { label: 'Несколько вариантов', description: 'Пользователь может выбрать несколько вариантов.' },
    end: { label: 'Финальная точка', description: 'Завершает сценарий. Можно включить перезапуск.' },
  },
};
