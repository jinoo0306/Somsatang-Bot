import { Injectable } from '@nestjs/common';
import { Client, CommandInteraction, GuildMember } from 'discord.js';
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';
import axios from 'axios';
import play from 'play-dl'; // play-dl 사용

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

  private async handlePlay(interaction: CommandInteraction) {
    const keyword = interaction.options.get('keyword')?.value as string;

    if (!keyword) {
      await interaction.reply('검색할 키워드를 입력하세요.');
      return;
    }

    // YouTube Data API를 사용하여 동영상 검색
    const videoUrl = await this.searchYouTube(keyword);
    console.log('videoUrl:', videoUrl);

    if (videoUrl) {
      // play-dl을 사용하여 스트리밍
      const stream = await play.stream(videoUrl);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
      });

      this.player.play(resource);

      const member = interaction.member as GuildMember;
      const channel = member.voice.channel;

      if (channel) {
        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
        });

        connection.subscribe(this.player);
        await interaction.reply(`재생 중: **${videoUrl}**`);
      } else {
        await interaction.reply('먼저 음성 채널에 들어가셔야 합니다.');
      }
    } else {
      await interaction.reply('검색 결과를 찾지 못했습니다.');
    }
  }

  // YouTube Data API를 사용하여 검색
  private async searchYouTube(query: string): Promise<string | null> {
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(
        query,
      )}&key=${apiKey}`;

      const response = await axios.get(url);
      console.log('YouTube search response:', response.data);
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
