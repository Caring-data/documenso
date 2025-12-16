import { Trans } from '@lingui/macro';
import {
  Building,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clipboard,
  Contact,
  Disc,
  Flag,
  Hash,
  Home,
  Mail,
  MapPin,
  Phone,
  Printer,
  Type,
  User,
  UserCheck,
  UserCircle2,
} from 'lucide-react';

import type { TFieldMetaSchema as FieldMetaType } from '@documenso/lib/types/field-meta';
import { FieldType } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';

type FieldIconProps = {
  fieldMeta: FieldMetaType;
  type: FieldType;
  signerEmail?: string;
  fontCaveatClassName?: string;
};

const fieldIcons = {
  [FieldType.INITIALS]: { icon: Contact, label: 'Initials' },
  [FieldType.EMAIL]: { icon: Mail, label: 'Email' },
  [FieldType.NAME]: { icon: User, label: 'Name' },
  [FieldType.DATE]: { icon: Calendar, label: 'Date' },
  [FieldType.TEXT]: { icon: Type, label: 'Text' },
  [FieldType.NUMBER]: { icon: Hash, label: 'Number' },
  [FieldType.RADIO]: { icon: Disc, label: 'Radio' },
  [FieldType.CHECKBOX]: { icon: CheckSquare, label: 'Checkbox' },
  [FieldType.DROPDOWN]: { icon: ChevronDown, label: 'Select' },
  [FieldType.CALENDAR]: { icon: CalendarDays, label: 'Calendar' },
  [FieldType.RESIDENT_FIRST_NAME]: { icon: User, label: 'R. First Name' },
  [FieldType.RESIDENT_LAST_NAME]: { icon: User, label: 'R. Last Name' },
  [FieldType.RESIDENT_DOB]: { icon: CalendarDays, label: 'R. Date of Birth' },
  [FieldType.RESIDENT_GENDER_IDENTITY]: { icon: UserCircle2, label: 'R. Gender Identity' },
  [FieldType.RESIDENT_LOCATION_NAME]: { icon: Building, label: 'L. Name' },
  [FieldType.RESIDENT_LOCATION_STATE]: { icon: Flag, label: 'L. State' },
  [FieldType.RESIDENT_LOCATION_ADDRESS]: { icon: Home, label: 'L. Address' },
  [FieldType.RESIDENT_LOCATION_CITY]: { icon: Building, label: 'L. City' },
  [FieldType.RESIDENT_LOCATION_ZIP_CODE]: { icon: Hash, label: 'L. Zip Code' },
  [FieldType.RESIDENT_LOCATION_COUNTRY]: { icon: MapPin, label: 'L. Country' },
  [FieldType.RESIDENT_LOCATION_FAX]: { icon: Printer, label: 'L. Fax' },
  [FieldType.RESIDENT_LOCATION_LICENSING]: { icon: Clipboard, label: 'Licensing Number' },
  [FieldType.RESIDENT_LOCATION_LICENSING_NAME]: { icon: UserCircle2, label: 'Licensee Name' },
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME]: {
    icon: UserCheck,
    label: 'L. Admin Name',
  },
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE]: {
    icon: Phone,
    label: 'L. Admin Phone',
  },
};

export const FieldIcon = ({
  fieldMeta,
  type,
  signerEmail,
  fontCaveatClassName,
}: FieldIconProps) => {
  if (type === 'SIGNATURE' || type === 'FREE_SIGNATURE') {
    return (
      <div
        className={cn(
          'text-field-card-foreground flex items-center justify-center gap-x-1 text-[clamp(0.575rem,25cqw,1.2rem)]',
          fontCaveatClassName,
        )}
      >
        <Trans>Signature</Trans>
      </div>
    );
  } else {
    const Icon = fieldIcons[type]?.icon;
    let label;

    if (fieldMeta && (type === 'TEXT' || type === 'NUMBER')) {
      if (type === 'TEXT' && 'text' in fieldMeta && fieldMeta.text && !fieldMeta.label) {
        label =
          fieldMeta.text.length > 20 ? fieldMeta.text.substring(0, 20) + '...' : fieldMeta.text;
      } else if (fieldMeta.label) {
        label =
          fieldMeta.label.length > 20 ? fieldMeta.label.substring(0, 20) + '...' : fieldMeta.label;
      } else {
        label = fieldIcons[type]?.label;
      }
    } else {
      label = fieldIcons[type]?.label;
    }

    return (
      <div className="text-field-card-foreground flex items-center justify-center gap-x-1.5 text-[clamp(0.425rem,25cqw,0.825rem)]">
        <Icon className="h-[clamp(0.625rem,20cqw,0.925rem)] w-[clamp(0.625rem,20cqw,0.925rem)]" />{' '}
        {label}
      </div>
    );
  }
};
