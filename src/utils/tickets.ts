/**
 * Almacenamiento de los tickets de cada servidor en data/tickets/<guildId>.json: el contador para
 * numerarlos y los tickets abiertos y cerrados. Los cerrados se borran pasados CLOSED_TICKET_TTL_MS;
 * su transcripción queda en el canal de registro, no en disco.
 */
import fs from 'fs';
import path from 'path';
import { AlbionServer } from './albion';
import { TicketSettings } from '../types/ping';

const TICKETS_DIR = path.join(process.cwd(), 'data', 'tickets');
/** Tiempo que se guardan los tickets cerrados (para reabrirlos o borrarlos). */
export const CLOSED_TICKET_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Ajustes de tickets de un servidor que nunca los ha configurado. */
export function defaultTicketSettings(): TicketSettings {
  return { albionServer: 'americas', dmUser: true, types: [], panels: [] };
}

/** Ticket abierto o cerrado. */
export interface Ticket {
  id: string;
  /** Número correlativo dentro del servidor (0001, 0002…). */
  number: number;
  typeId: string;
  typeName: string;
  userId: string;
  userName: string;
  channelId: string;
  kind: 'channel' | 'thread';
  status: 'open' | 'closed';
  createdAt: number;
  answers: Array<{ question: string; answer: string }>;
  claimedBy?: string;
  closedAt?: number;
  closedBy?: string;
  closeReason?: string;
  /** Personaje de Albion (reclutamiento). playerId se rellena al encontrarlo en la API. */
  albion?: { server: AlbionServer; name: string; playerId?: string };
  decision?: { result: 'accepted' | 'rejected'; by: string; at: number };
}

interface GuildTickets {
  counter: number;
  tickets: Record<string, Ticket>;
}

const cache = new Map<string, GuildTickets>();

function filePath(guildId: string) {
  if (!/^\d{5,25}$/.test(guildId)) throw new Error(`guildId inválido: ${guildId}`);
  return path.join(TICKETS_DIR, `${guildId}.json`);
}

function load(guildId: string): GuildTickets {
  const hit = cache.get(guildId);
  if (hit) return hit;
  let data: GuildTickets = { counter: 0, tickets: {} };
  const file = filePath(guildId);
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf-8')) as GuildTickets;
      data.tickets ||= {};
      data.counter ||= 0;
    } catch (err) {
      console.error(`Tickets de ${guildId} dañados; se empieza de cero:`, err);
    }
  }
  cache.set(guildId, data);
  prune(data);
  return data;
}

function save(guildId: string, data: GuildTickets) {
  prune(data);
  fs.mkdirSync(TICKETS_DIR, { recursive: true });
  const file = filePath(guildId);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, file);
}

function prune(data: GuildTickets, now = Date.now()) {
  for (const [id, t] of Object.entries(data.tickets)) {
    if (t.status === 'closed' && now - (t.closedAt ?? t.createdAt) > CLOSED_TICKET_TTL_MS) delete data.tickets[id];
  }
}

/** Crea un ticket con el siguiente número y lo guarda. */
export function createTicket(guildId: string, t: Omit<Ticket, 'id' | 'number' | 'status' | 'createdAt'>): Ticket {
  const data = load(guildId);
  data.counter++;
  const ticket: Ticket = { ...t, id: t.channelId, number: data.counter, status: 'open', createdAt: Date.now() };
  data.tickets[ticket.id] = ticket;
  save(guildId, data);
  return ticket;
}

/** Reserva el siguiente número sin crear el ticket (para nombrar el canal antes de crearlo). */
export function peekNextNumber(guildId: string): number {
  return load(guildId).counter + 1;
}

/** Ticket por id (el id es el del canal o hilo). */
export function getTicket(guildId: string, id: string): Ticket | undefined {
  return load(guildId).tickets[id];
}

/** Guarda los cambios de un ticket. */
export function saveTicket(guildId: string, ticket: Ticket): void {
  const data = load(guildId);
  data.tickets[ticket.id] = ticket;
  save(guildId, data);
}

/** Borra un ticket del registro (cuando se borra su canal). */
export function deleteTicket(guildId: string, id: string): void {
  const data = load(guildId);
  if (!data.tickets[id]) return;
  delete data.tickets[id];
  save(guildId, data);
}

/** Tickets abiertos del servidor, del más nuevo al más antiguo. */
export function openTickets(guildId: string): Ticket[] {
  return Object.values(load(guildId).tickets)
    .filter((t) => t.status === 'open')
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Ticket abierto del usuario de ese tipo, si lo tiene. */
export function openTicketOf(guildId: string, userId: string, typeId: string): Ticket | undefined {
  return openTickets(guildId).find((t) => t.userId === userId && t.typeId === typeId);
}

/** Número con cuatro cifras: 7 → 0007. */
export function ticketNumber(n: number): string {
  return String(n).padStart(4, '0');
}

/** Libera la caché de un servidor. */
export function evictTickets(guildId: string): void {
  cache.delete(guildId);
}

/** Borra los tickets de un servidor (retención de datos). */
export function purgeTickets(guildId: string): void {
  cache.delete(guildId);
  const file = filePath(guildId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
