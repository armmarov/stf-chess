export const CLASS_VALUES = [
  '1S','1T','1F','1J','1B',
  '2S','2T','2F','2J','2B',
  '3S','3T','3F','3J','3B',
  '4S','4T','4F','4J','4B',
  '5S','5T','5F','5J','5B',
] as const

export type ClassName = typeof CLASS_VALUES[number]
