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
  private queue = new Map<
    string,
    { connection: typeof VoiceConnection; songs: string[]; loop: boolean }
  >();

  constructor(private client: Client) {
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;

      const { commandName } = interaction;

      if (commandName === 'play') {
        await this.handlePlay(interaction);
      } else if (commandName === 'skip') {
        await this.handleSkip(interaction);
      } else if (commandName === 'disconnect') {
        await this.handleDisconnect(interaction);
      } else if (commandName === 'loop') {
        await this.handleLoop(interaction);
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
      const member = interaction.member as GuildMember;
      const channel = member.voice.channel;

      if (!channel) {
        await interaction.reply('먼저 음성 채널에 들어가셔야 합니다.');
        return;
      }

      const guildId = interaction.guildId!;
      const guildQueue = this.queue.get(guildId);

      if (guildQueue) {
        guildQueue.songs.push(videoUrl); // 큐에 노래 추가
        await interaction.reply(`재생 대기열에 추가됨: **${videoUrl}**`);
      } else {
        const connection = this.connectToVoiceChannel(channel);
        this.queue.set(guildId, { connection, songs: [videoUrl], loop: false });

        await this.playSong(guildId, interaction); // 첫 번째 노래 재생
        await interaction.reply(`재생 중: **${videoUrl}**`);
      }
    } else {
      await interaction.reply('검색 결과를 찾지 못했습니다.');
    }
  }

  // 'skip' 명령어 처리
  private async handleSkip(interaction: CommandInteraction) {
    const guildId = interaction.guildId!;
    const guildQueue = this.queue.get(guildId);

    if (!guildQueue || guildQueue.songs.length === 0) {
      await interaction.reply('재생 중인 노래가 없습니다.');
      return;
    }

    guildQueue.songs.shift(); // 현재 노래 제거
    if (guildQueue.songs.length > 0) {
      await this.playSong(guildId, interaction);
      await interaction.reply('다음 노래로 건너뜁니다.');
    } else {
      guildQueue.connection.destroy();
      this.queue.delete(guildId);
      await interaction.reply('재생할 노래가 없습니다. 음성 채널을 나갑니다.');
    }
  }

  // 'disconnect' 명령어 처리
  private async handleDisconnect(interaction: CommandInteraction) {
    const guildId = interaction.guildId!;
    const guildQueue = this.queue.get(guildId);

    if (!guildQueue) {
      await interaction.reply('봇이 음성 채널에 연결되어 있지 않습니다.');
      return;
    }

    guildQueue.connection.destroy();
    this.queue.delete(guildId);
    await interaction.reply('봇이 음성 채널에서 나갔습니다.');
  }

  // 'loop' 명령어 처리
  private async handleLoop(interaction: CommandInteraction) {
    const guildId = interaction.guildId!;
    const guildQueue = this.queue.get(guildId);

    if (!guildQueue) {
      await interaction.reply('현재 재생 중인 노래가 없습니다.');
      return;
    }

    guildQueue.loop = !guildQueue.loop;
    await interaction.reply(
      `루프 상태: ${guildQueue.loop ? '활성화됨' : '비활성화됨'}`,
    );
  }

  // 노래 재생 함수
  private async playSong(guildId: string, interaction: CommandInteraction) {
    const guildQueue = this.queue.get(guildId);
    if (!guildQueue || guildQueue.songs.length === 0) return;

    const videoUrl = guildQueue.songs[0];
    try {
      const stream = ytdl(videoUrl, {
        highWaterMark: 1 << 25,
        quality: 'highestaudio',
        liveBuffer: 4900,
        filter: 'audioonly',
      });
      const resource = createAudioResource(stream);

      guildQueue.connection.subscribe(this.player);
      this.player.play(resource);

      this.player.on(AudioPlayerStatus.Idle, () => {
        if (!guildQueue.loop) {
          guildQueue.songs.shift(); // 현재 노래를 큐에서 제거
        }

        if (guildQueue.songs.length > 0) {
          this.playSong(guildId, interaction); // 다음 노래 재생
        } else {
          guildQueue.connection.destroy();
          this.queue.delete(guildId); // 노래가 없으면 음성 채널에서 나가기
        }
      });
    } catch (error) {
      console.error('Error during streaming:', error);
      await interaction.reply('음악을 재생하는 중 오류가 발생했습니다.');
      guildQueue.connection.destroy();
      this.queue.delete(guildId);
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
