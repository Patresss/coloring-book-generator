import React from 'react';
import { Avatar, Box, Chip } from '@mui/material';
import { stripExtension } from '../utils/strings';
import { sky } from '../theme';

type PeopleChipsProps = {
  // Reference file names, e.g. "Achim - Dziadek.jpg"
  references: string[];
  size?: 'small' | 'medium';
  justify?: 'center' | 'flex-start';
};

const AVATAR_COLORS = ['#FFC4D6', '#BCDCFF', '#C9F0C2', '#FFE3A3', '#E6D4FF', '#FFD9B8', '#B9F0EC', '#FFD0D0'];

// "Achim - Dziadek.jpg" -> { name: "Achim", role: "Dziadek" }; "Halszka.jpg" -> { name: "Halszka", role: "" }
export const splitPersonName = (fileName: string): { name: string; role: string } => {
  const base = stripExtension(fileName).trim();
  const [name, ...rest] = base.split(/\s+[-–—]\s+/);
  return { name: name.trim() || base, role: rest.join(' - ').trim() };
};

// Inverse of splitPersonName: "Achim" + "Dziadek" -> "Achim - Dziadek"
export const joinPersonName = (name: string, role: string): string => {
  const n = name.replace(/\s+/g, ' ').trim();
  const r = role.replace(/\s+/g, ' ').trim();
  return r ? `${n} - ${r}` : n;
};

// Display form with a lowercase role: "Achim" + "dziadek"
export const parsePerson = (fileName: string): { name: string; role?: string } => {
  const { name, role } = splitPersonName(fileName);
  return { name, role: role ? role.toLocaleLowerCase('pl-PL') : undefined };
};

export const colorFor = (value: string) => {
  let hash = 0;
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const PeopleChips: React.FC<PeopleChipsProps> = ({ references, size = 'medium', justify = 'center' }) => {
  if (references.length === 0) return null;
  const big = size === 'medium';
  return (
    <Box
      component="ul"
      aria-label="Osoby na rysunku"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: justify }}
    >
      {references.map((ref) => {
        const { name, role } = parsePerson(ref);
        return (
          <li key={ref}>
            <Chip
              avatar={
                <Avatar sx={{ bgcolor: colorFor(name), color: `${sky.ink} !important`, fontWeight: 800 }}>
                  {name.charAt(0).toLocaleUpperCase('pl-PL')}
                </Avatar>
              }
              label={
                <span>
                  <Box component="span" sx={{ fontWeight: 800 }}>{name}</Box>
                  {role && (
                    <Box component="span" sx={{ fontWeight: 600, color: sky.muted, ml: 0.5 }}>{role}</Box>
                  )}
                </span>
              }
              sx={{
                height: big ? 40 : 32,
                borderRadius: 999,
                bgcolor: '#fff',
                border: `1.5px solid ${sky.line}`,
                color: sky.ink,
                fontSize: big ? 15 : 13.5,
                '& .MuiChip-avatar': { width: big ? 30 : 24, height: big ? 30 : 24, fontSize: big ? 14 : 12, ml: '5px' },
                '& .MuiChip-label': { px: big ? 1.25 : 1 },
              }}
            />
          </li>
        );
      })}
    </Box>
  );
};
