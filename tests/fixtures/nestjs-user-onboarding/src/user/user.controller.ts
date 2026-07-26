import { Controller, Post, Body, Param, HttpCode } from '@nestjs/common';
import { UserService, RegisterUserInput } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: RegisterUserInput) {
    const user = await this.userService.registerUser(body);
    return { success: true, userId: user.id, status: user.status };
  }

  @Post(':token/verify')
  @HttpCode(200)
  async verifyEmail(@Param('token') token: string) {
    const user = await this.userService.verifyEmail(token);
    return { success: true, userId: user.id, status: user.status };
  }
}
