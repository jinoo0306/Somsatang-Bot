import { REST } from '@discordjs/rest';
import { NestFactory } from '@nestjs/core';
import { Routes } from 'discord-api-types/v9';
import { AppModule } from './app.module';
import { Client } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  const client = app.get(Client);

  // 슬래시 명령어 정의
  const commands = [
    {
      name: 'play',
      description: '노래를 재생합니다.',
      options: [
        {
          name: 'keyword',
          type: 3, // 문자열
          description: '유튜브에서 검색할 키워드',
          required: true,
        },
      ],
    },
    { name: 'skip', description: '현재 재생 중인 노래를 건너뜁니다.' },
    { name: 'disconnect', description: '봇이 음성 채널에서 나갑니다.' },
    { name: 'loop', description: '현재 재생 중인 노래를 반복합니다.' },
  ];

  const rest = new REST({ version: '9' }).setToken(botToken);

  try {
    // 전역 슬래시 명령어 등록
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log('전역 명령어가 성공적으로 등록되었습니다.');
  } catch (error) {
    console.error('전역 명령어 등록 중 오류 발생:', error);
  }

  await client.login(botToken);
  await app.listen(7770);
}
bootstrap();
