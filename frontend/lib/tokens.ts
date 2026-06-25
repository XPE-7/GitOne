// Design token constants for use in Framer Motion (can't read CSS vars in animate props)
export const tokens = {
  ink:       '#0E1726',
  slate:     '#1B2A41',
  mist:      '#C7D2E1',
  amber:     '#E8A33D',
  verdigris: '#3FA68A',
  rust:      '#C75B4A',
} as const

export type TokenKey = keyof typeof tokens
