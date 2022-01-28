
export interface UserDto {
	id: string;
	login: string;
	name: string;
	avatar: string;
	fortyTwoAvatar: string;
	email: string;
  online: boolean;
	// friends: string[];
	// history: HistoryDto[]; // ?
	// xp: number;
	// level: number;
	// updated: Date;
}

export interface LimitedUserDto {
  id: string;
	login: string;
	name: string;
	avatar: string;
	fortyTwoAvatar: string;
	email: string;
  online: boolean;
}

export interface HistoryDto {
	id: number;
	user_id: string;
	status: boolean; // win or lose
}