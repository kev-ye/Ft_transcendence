import { Inject, Injectable } from '@nestjs/common';

import { UserService } from 'src/user/user.service';
import { LimitedUserDto, UserDto } from 'src/user/dto/user.dto';

@Injectable()
export class AuthService {
  constructor(@Inject('USER_SERVICE') private readonly userService: UserService) {}

  public async ftValidUser(user: LimitedUserDto): Promise<UserDto> {
    return await this.userService.updateUserByAuth(user);
  }
}
