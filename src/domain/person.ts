export const GENDERS = ['male', 'female'] as const

export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男',
  female: '女',
}

export interface Person {
  id: string
  name: string
  gender: Gender
  createdAt: string
  updatedAt: string
}
