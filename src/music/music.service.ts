/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import { Injectable } from '@nestjs/common';
import { Client, CommandInteraction, GuildMember } from 'discord.js';
const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnection,
} = require('@discordjs/voice');
import axios from 'axios';
const ytdl = require('@distube/ytdl-core');

@Injectable()
export class MusicService {
  private player = createAudioPlayer();

  constructor(private client: Client) {
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;

      const { commandName } = interaction;
      if (commandName === 'play') {
        await this.handlePlay(interaction);
      }
    });
  }

  // 'play' 명령어 처리
  private async handlePlay(interaction: CommandInteraction) {
    const keyword = interaction.options.get('keyword')?.value as string;

    if (!keyword) {
      await interaction.reply('검색할 키워드를 입력하세요.');
      return;
    }

    // 유튜브에서 동영상 URL 검색
    const videoUrl = await this.searchYouTube(keyword);

    if (videoUrl) {
      try {
        const stream = ytdl(videoUrl, {
          highWaterMark: 1 << 25,
          quality: 'highestaudio',
          liveBuffer: 4900,
          filter: 'audioonly',
        });
        const resource = createAudioResource(stream);

        const member = interaction.member as GuildMember;
        const channel = member.voice.channel;

        if (channel) {
          const connection = this.connectToVoiceChannel(channel);
          connection.subscribe(this.player);

          this.player.play(resource);
          this.player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy(); // 음악이 끝나면 음성 채널 연결 종료
          });

          await interaction.reply(`재생 중: **${videoUrl}**`);
        } else {
          await interaction.reply('먼저 음성 채널에 들어가셔야 합니다.');
        }
      } catch (error) {
        console.error('Error during streaming:', error);

        if (error.response?.status === 403) {
          console.error('403 오류: 해당 동영상에 접근할 수 없습니다.');
          await interaction.reply(
            '403 오류: 해당 동영상에 접근할 수 없습니다.',
          );
        } else {
          await interaction.reply('음악을 재생하는 중 오류가 발생했습니다.');
        }

        // 오류 발생 시 음성 채널에서 나감
        const member = interaction.member as GuildMember;
        const channel = member.voice.channel;
        if (channel) {
          const connection = this.connectToVoiceChannel(channel);
          connection.destroy();
        }
      }
    } else {
      await interaction.reply('검색 결과를 찾지 못했습니다.');
    }
  }
  // 음성 채널에 연결하는 메서드
  private connectToVoiceChannel(channel: any): typeof VoiceConnection {
    return joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });
  }

  // 유튜브 검색 함수
  private async searchYouTube(query: string): Promise<string | null> {
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(
        query,
      )}&key=${apiKey}`;

      const response = await axios.get(url);
      const videoId = response.data.items[0]?.id?.videoId;

      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }

      return null;
    } catch (error) {
      console.error('YouTube search error:', error);
      return null;
    }
  }
}
