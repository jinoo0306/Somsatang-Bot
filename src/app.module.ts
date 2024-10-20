import { Module } from '@nestjs/common';
import { MusicService } from './music/music.service';
import { Client, GatewayIntentBits } from 'discord.js';

@Module({
  providers: [
    MusicService,
    {
      provide: Client, // Discord.js Client를 제공
      useFactory: () => {
        return new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
          ],
        });
      },
    },
  ],
})
export class AppModule {}
