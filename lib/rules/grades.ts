// Lowest to highest. A grade's value is its place in this list: F 1 to A+ 7.
export const GRADES = ["F", "D", "C", "B", "B+", "A", "A+"] as const;

export type Grade = (typeof GRADES)[number];

export function gradeValue(grade: Grade) {
  return GRADES.indexOf(grade) + 1;
}

// One grade higher, capped at A+.
export function nextGrade(grade: Grade): Grade {
  return GRADES[Math.min(GRADES.indexOf(grade) + 1, GRADES.length - 1)];
}
