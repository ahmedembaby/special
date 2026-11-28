/** Arab League countries only (22). Egypt first: it is the default selection in the phone-entry screen. */
export const COUNTRIES = [
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+967', flag: '🇾🇪', name: 'Yemen' },
  { code: '+964', flag: '🇮🇶', name: 'Iraq' },
  { code: '+962', flag: '🇯🇴', name: 'Jordan' },
  { code: '+961', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+963', flag: '🇸🇾', name: 'Syria' },
  { code: '+970', flag: '🇵🇸', name: 'Palestine' },
  { code: '+218', flag: '🇱🇾', name: 'Libya' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213', flag: '🇩🇿', name: 'Algeria' },
  { code: '+212', flag: '🇲🇦', name: 'Morocco' },
  { code: '+222', flag: '🇲🇷', name: 'Mauritania' },
  { code: '+249', flag: '🇸🇩', name: 'Sudan' },
  { code: '+252', flag: '🇸🇴', name: 'Somalia' },
  { code: '+253', flag: '🇩🇯', name: 'Djibouti' },
  { code: '+269', flag: '🇰🇲', name: 'Comoros' },
];

export interface Country {
  code: string;
  flag: string;
  name: string;
}

export { COUNTRIES as countries };
