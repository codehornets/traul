import type { MessageRow, Stats } from "../db/database";

function formatTimestamp(unixTs: number): string {
  return new Date(unixTs * 1000).toISOString().replace("T", " ").slice(0, 19);
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

export function formatMessage(msg: MessageRow): string {
  const time = formatTimestamp(msg.sent_at);
  const channel = msg.channel_name ? `#${msg.channel_name}` : msg.source;
  const author = msg.author_name ?? "unknown";
  const content = truncate(msg.content.replace(/\n/g, " "), 120);
  return `${time}  ${channel}  ${author}: ${content}`;
}

export function formatStats(stats: Stats): string {
  return [
    `Messages: ${stats.total_messages}`,
    `Channels: ${stats.total_channels}`,
    `Contacts: ${stats.total_contacts}`,
  ].join("\n");
}

export function formatJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

