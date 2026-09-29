export const CHILDREN_ACADEMY_COLORS = [
  { id: 'blue', label: '블루', background: '#eaf2ff', border: '#bfd3f5', text: '#244a7a' },
  { id: 'mint', label: '민트', background: '#e8f6ef', border: '#b9dfc9', text: '#235b3b' },
  { id: 'lavender', label: '라벤더', background: '#f1edff', border: '#d1c5f4', text: '#4e3f7b' },
  { id: 'peach', label: '피치', background: '#fff0e7', border: '#f3cbb5', text: '#76442d' },
  { id: 'yellow', label: '버터', background: '#fff8d9', border: '#eadb9b', text: '#6a5417' },
  { id: 'rose', label: '로즈', background: '#fcebf0', border: '#e8c1ce', text: '#743a4d' },
  { id: 'sky', label: '스카이', background: '#e8f5fa', border: '#b8dce8', text: '#28586b' },
  { id: 'sage', label: '세이지', background: '#eef2e6', border: '#cbd5b8', text: '#48543a' },
  { id: 'gray', label: '연회색', background: '#f1f2f4', border: '#d2d5da', text: '#444b54' },
  { id: 'cream', label: '크림', background: '#f7f1e6', border: '#e3d3b4', text: '#61513a' },
  { id: 'coral', label: '코랄', background: '#fde9e4', border: '#edc1b7', text: '#7b4138' },
  { id: 'periwinkle', label: '페리윙클', background: '#e9ecfb', border: '#c3c9e8', text: '#404d78' },
] as const;

export type ChildrenAcademyColor = typeof CHILDREN_ACADEMY_COLORS[number]['id'];
export const DEFAULT_CHILDREN_ACADEMY_COLOR: ChildrenAcademyColor = 'blue';
