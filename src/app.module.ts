import { Module } from '@nestjs/common';
import { MusicService } from './music/music.service';
import { NecordModule } from 'necord'; // Necord 모듈을 가져옵니다.
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(), // .env 파일을 사용하여 설정
    NecordModule.forRoot({
      token: process.env.DISCORD_BOT_TOKEN, // .env 파일에서 봇 토큰 불러오기
      intents: ['Guilds', 'GuildVoiceStates'], // 필요한 Discord 인텐트 설정
    }),
  ],
  providers: [MusicService], // MusicService를 등록합니다.
})
export class AppModule {}
