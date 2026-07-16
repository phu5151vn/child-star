const API_BASE = '/api/v1';

export interface ApiError {
  error_code: string;
  message: string;
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export function getStoredRole(): string | null {
  return localStorage.getItem('role');
}

export function setStoredRole(role: string | null) {
  if (role) localStorage.setItem('role', role);
  else localStorage.removeItem('role');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
  ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const detail = body.detail ?? body;
    throw new ApiClientError(
      detail.error_code ?? 'UNKNOWN',
      detail.message ?? detail ?? 'Lỗi không xác định',
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: async (file: File, kind: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    return request<{ media_id: string }>('/media', { method: 'POST', body: form, headers: {} });
  },
  /**
   * Tải ảnh media có kèm Bearer token và trả về Object URL để dùng cho <img>.
   * (Endpoint /media yêu cầu Authorization header nên không thể gán trực tiếp vào src.)
   * Nhớ gọi URL.revokeObjectURL(url) khi không dùng nữa.
   */
  fetchMediaObjectUrl: async (mediaId: string): Promise<string> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/media/${mediaId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiClientError('MEDIA_LOAD_FAILED', 'Không tải được ảnh', res.status);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

// Types
export interface Me {
  id: string;
  role: 'parent' | 'child';
  display_name: string;
  gender?: 'male' | 'female' | null;
  family_id: string;
  family_code?: string;
  child_id?: string;
  balance?: number;
  is_admin?: boolean;
  can_manage_members?: boolean;
  can_approve_tasks?: boolean;
  can_approve_rewards?: boolean;
}

export interface Relative {
  id: string;
  display_name: string;
  email?: string | null;
  is_admin: boolean;
  is_active: boolean;
  can_manage_members: boolean;
  can_approve_tasks: boolean;
  can_approve_rewards: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  points: number;
  icon_emoji?: string | null;
  recurrence: 'once' | 'daily' | 'weekly';
  require_proof: boolean;
  is_active: boolean;
  assignment_status?: string;
  assignment_id?: string;
}

export interface Assignment {
  id: string;
  task_id: string;
  child_id: string;
  status: string;
  task_title?: string;
  task_points?: number;
  task_emoji?: string | null;
  child_name?: string;
  child_gender?: 'male' | 'female' | null;
  proof_media_id?: string;
  reject_reason?: string;
  submitted_at?: string;
  is_custom?: boolean;
}

export interface Reward {
  id: string;
  title: string;
  description?: string;
  required_points: number;
  icon_emoji?: string | null;
  stock?: number | null;
  is_active: boolean;
  is_unlocked?: boolean;
  missing_points?: number;
  is_out_of_stock: boolean;
  is_pending?: boolean;
}

export interface Redemption {
  id: string;
  reward_id: string;
  child_id: string;
  status: string;
  points_spent?: number;
  reward_title?: string;
  reward_emoji?: string | null;
  child_name?: string;
  child_gender?: 'male' | 'female' | null;
  reject_reason?: string;
  requested_at: string;
  is_custom?: boolean;
}

export interface LedgerEntry {
  id: string;
  delta: number;
  kind: string;
  reason?: string;
  created_at: string;
}

export interface ChildProfile {
  id: string;
  display_name: string;
  gender?: 'male' | 'female' | null;
}

export interface Child {
  id: string;
  display_name: string;
  gender?: 'male' | 'female' | null;
  is_active: boolean;
  balance: number;
  weekly_completed: number;
}

export interface Family {
  id: string;
  name: string;
  family_code: string;
}

export interface WeeklyGoal {
  id?: string | null;
  target_count?: number | null;
  bonus_points?: number | null;
  is_active: boolean;
}

export interface WeeklyProgress {
  child_id: string;
  enabled: boolean;
  target_count: number;
  bonus_points: number;
  completed: number;
  remaining: number;
  achieved: boolean;
  bonus_earned: boolean;
  week_start?: string | null;
}

// Games (cờ caro & cờ vua)
export type GameType = 'caro' | 'chess';
export type GameStatus = 'waiting' | 'active' | 'finished' | 'abandoned';
export type Side = 'x' | 'o' | 'white' | 'black';
export type GameResult = 'host_win' | 'guest_win' | 'draw';

export interface GamePlayer {
  id: string;
  display_name: string;
  gender?: 'male' | 'female' | null;
}

export interface CaroState {
  size: number;
  block_two_ends: boolean;
  board: (Side | null)[][];
  moves: { r: number; c: number; by: Side }[];
}

export interface ChessState {
  fen: string;
  last_move: string | null;
  history: string[];
}

export interface CaroWinLine {
  cells: [number, number][];
  dir: [number, number];
}

export interface GameMatch {
  id: string;
  game_type: GameType;
  status: GameStatus;
  host?: GamePlayer | null;
  guest?: GamePlayer | null;
  host_side: Side;
  guest_side?: Side | null;
  your_side?: Side | null;
  turn_user_id?: string | null;
  is_your_turn: boolean;
  state: CaroState | ChessState;
  result?: GameResult | null;
  winner_id?: string | null;
  win_line?: CaroWinLine | null;
  pending_offer?: 'draw' | 'takeback' | null;
  pending_by?: string | null;
  version: number;
  created_at: string;
}

export interface GameSummary {
  id: string;
  game_type: GameType;
  status: GameStatus;
  host_name?: string | null;
  guest_name?: string | null;
  is_yours: boolean;
  created_at: string;
}

// Cờ cá ngựa (Ludo)
export interface LudoPlayer {
  user_id: string;
  name: string;
  gender?: 'male' | 'female' | null;
  color: number; // 0..3
  tokens: number[]; // 4 quân: -1 chuồng, 0..50 vòng, 51..56 cầu thang/đích
  is_you: boolean;
  is_turn: boolean;
}

export interface LudoLastAction {
  type: 'roll' | 'move' | 'no_move' | 'burn_six';
  color: number;
  dice?: number;
  token?: number;
  to?: number;
  reroll?: boolean;
  captures?: { color: number; token: number }[];
}

export interface LudoMatch {
  id: string;
  status: 'waiting' | 'active' | 'finished';
  created_by: string;
  is_creator: boolean;
  you_joined: boolean;
  players: LudoPlayer[];
  turn: number;
  turn_color: number | null;
  turn_user_id: string | null;
  is_your_turn: boolean;
  dice: number | null;
  can_roll: boolean;
  movable_tokens: number[];
  free_slots: number;
  winner_id: string | null;
  winner_name: string | null;
  last: LudoLastAction | null;
  version: number;
}

export interface LudoSummary {
  id: string;
  status: 'waiting' | 'active' | 'finished';
  player_count: number;
  player_names: string[];
  is_yours: boolean;
  is_creator: boolean;
  created_at: string | null;
}
