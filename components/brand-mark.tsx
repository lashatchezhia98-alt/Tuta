import Image from 'next/image';
import icon from '@/public/tuta-icon.png';

/** The same artwork used by the iOS app, shared by all web branding. */
export default function BrandMark() {
  return <Image src={icon} alt="" width={44} height={44} className="tuta-brand-mark" />;
}
