import { Inject, Logger, Req } from '@nestjs/common';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

import { ActiveUsersService } from 'src/active-users/active-users.service';
import { ChannelsService } from 'src/channels/channels.service';
import { ChatHistoryService } from 'src/chat-history/chat-history.service';
import { PrivateService } from 'src/private/private.service';
import { UserService } from 'src/user/user.service';

@WebSocketGateway(3001, {
	path: '/chat/socket.io',
	namespace: 'chat',
	cors: {
		origin: [
			'http://localhost',
			'http://localhost:80',
			'http://localhost:4200',
		],
		methods: ['GET', 'POST'],
		credentials: true,
	},
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server: Server;
	
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	onModuleInit() {}
	
	rooms: Map<string, string> = new Map();
	
	constructor(
		@Inject('PRIVATE_SERVICE') private privateService: PrivateService,
		@Inject('USER_SERVICE') private userService: UserService,
		@Inject('CHAT_HISTORY_SERVICE') private history: ChatHistoryService,
		@Inject('CHANNELS_SERVICE') private chanService: ChannelsService,
		@Inject('ACTIVE_USERS_SERVICE') private activeService: ActiveUsersService,
		) {}
		
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async handleConnection(client: any, ...args: any[]) {
			this.rooms.set(client.id, '');
			await this.activeService.addUser({ id: client.id });
			client.emit('user');
		}
		
		handleDisconnect(client: any) {
			this.switchChannel(client);
			this.activeService.removeUserBySocketId(client.id).then();
			this.rooms.delete(client.id);
		}
		
		async emitToUser(userID: string, event: string, ...args: any[]) {
			const tmp = await this.activeService.getUser(userID);
			if (tmp.length > 0) {
				for (const it of tmp) {
					if (it.user_id == userID || userID == '') {
						if (this.server.sockets.sockets.has(it.id))
						this.server.sockets.sockets.get(it.id).emit(event, args);
					}
				}
			}
		}
		
		switchChannel(client: any, to?: string) {
			if (to != undefined)
			this.activeService.updateUser({ id: client.id, chat_id: to }).then();
			else this.activeService.updateUser({ id: client.id, chat_id: null }).then();
			let tmp = this.rooms.get(client.id);
			if (tmp != '') {
				client.leave(tmp);
				tmp = '';
			}
			if (to != undefined) {
				tmp = to;
				client.join(to);
			}
			this.rooms.set(client.id, tmp);
		}
		
		@SubscribeMessage('ban')
		async banUser(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
			//check if user is moderator
			Logger.log('banning', data);
			
			const user = await this.activeService.getUserBySocketId(client.id);
			if (!user || !user.user_id) return;
			if (
				!(await this.chanService.checkModerator(user.user_id, data)) ||
				(await this.chanService.checkModerator(data.user_id, data))
				) {
					Logger.log('moderator was targeted for ban');
					return; //return if emitter is not moderator or if target is moderator of channel
				}
				await this.chanService.banUser(user.user_id, data);
				
				const tmp = await this.activeService.getUser(data.user_id);
				console.log('banService', tmp);
				
				if (tmp.length > 0) {
					tmp.forEach((val) => {
						if (this.server.sockets.sockets.has(val.id)) {
							console.log('emit ban to ' + val.user_id);
							
							if (val.chat_id == data.chat_id) {
								const sock = this.server.sockets.sockets.get(val.id);
								sock.emit('ban');
								this.switchChannel(sock);
							}
						}
					});
				}
			}
			
			@SubscribeMessage('mod')
			async modUser(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
				const user = await this.activeService.getUserBySocketId(client.id);
				if (!user || !user.user_id || !data.chat_id || data.user_id) return;
				if (!(await this.chanService.checkOwner(user.user_id, data.chat_id)))
				return;
				await this.chanService.createModerator(data.user_id, data.chat_id);
				
				await this.emitToUser(data.chat_id, 'mod', data.chat_id);
			}
			
			@SubscribeMessage('user')
			async getUserFromSocket(
				@MessageBody() data: any,
				@ConnectedSocket() client: Socket,
				) {
					await this.activeService.updateUser({id: client.id, user_id: data.user_id});
				}
				
				@SubscribeMessage('message')
				async receiveMessage(
					@Req() req: any,
					@ConnectedSocket() client: Socket,
					@MessageBody()
					data: {
						user_id: string,
						message: string,
						type: number,
						chat: { public: boolean; id: string },
					}) {
						
						const tmp = await this.activeService.getUserBySocketId(client.id);
						console.log("message", data, tmp);
						if (!tmp || !tmp.user_id || !data.chat.id)
							return;
						
						const user = await this.userService.getUserById(tmp.user_id);
						console.log("message 2", user);
						
						if (!user) return;
						console.log("message 3", data);
						
						if (data.chat.public) {
							console.log("check access");
							
							if (await this.chanService.checkAccess(user.id, data.chat.id))
								return;
							console.log("checkmute");
							
							const mute = await this.chanService.getMute(data.chat.id, user.id);
							if (mute) {
								const now = new Date();
								if (now < mute.date) {
									client.emit('mute', { date: mute.date });
									return;
								}
							}
							
							const id = await this.history.create({
								user_id: user.id,
								message: data.message,
								type: data.type,
								chat_id: data.chat.id,
							});
							console.log("emitting message");
							
							this.server.to(data.chat.id).emit('message', {
								id: id.id,
								user_id: user.id,
								username: user.name,
								message: data.message,
								type: data.type,
							});
							return;
						}
						
						const id = await this.privateService.postMessage(tmp.user_id, {
							to: data.chat.id,
							type: data.type,
							message: data.message,
						});
						
						if (tmp.user_id < data.chat.id)
						this.server.to(tmp.user_id + ' | ' + data.chat.id).emit('message', {
							id: id.id,
							user_id: tmp.user_id,
							username: user.name,
							message: data.message,
							type: data.type,
						});
						// if (data.user_id != data.chat.id)
						else
						this.server.to(data.chat.id + ' | ' + tmp.user_id).emit('message', {
							id: id.id,
							user_id: tmp.user_id,
							username: user.name,
							message: data.message,
							type: data.type,
						});
						
						return;
					}
					
					@SubscribeMessage('connectRoom')
					async connectChannel(
						@ConnectedSocket() client: Socket,
						@MessageBody()
						data: {
							user_id: string;
							chat: { public: boolean; id: string };
							password?: string;
						},
						) {
							const user = await this.activeService.getUserBySocketId(client.id);
							if (!user || !user.user_id)
								return;
							
							if (data.chat.public) {
								if (await this.chanService.checkAccess(user.user_id, data.chat.id))
									return;
								const tmp = await this.chanService.getChannelById(data.chat.id);
								if (tmp) {
									if (tmp.access == 1) {
										if (data.password == undefined)
											return false;
										if (await this.chanService.checkPassword(data.password, data.chat.id))
											this.switchChannel(client, data.chat.id);
										else
											return false;
									} else if (tmp.access == 0)
										this.switchChannel(client, data.chat.id);
									else
										this.switchChannel(client, data.chat.id);
									return true;
								}
								return false;
							} else {
								//check to ?
								
								if (data.user_id < data.chat.id)
								this.switchChannel(client, data.user_id + ' | ' + data.chat.id);
								// if (data.user_id != data.chat.id)
								else
								this.switchChannel(client, data.chat.id + ' | ' + data.user_id);
							}
						}
						
						@SubscribeMessage('disconnectRoom')
						async disconnectChannel(@ConnectedSocket() client: Socket) {
							return this.switchChannel(client);
						}
					}
					