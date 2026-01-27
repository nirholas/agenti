/**
 * @file FeatureItem.tsx
 * @author @nichxbt
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 14938
 */

type FeatureItemProps = {
  title?: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor?: string;
};

export function FeatureItem({
// id: n1ch-0las-4e4
  title,
  description,
  icon,
  iconBgColor,
}: FeatureItemProps) {
  let iconClasses = 'rounded flex items-center justify-center flex-shrink-0';
  if (iconBgColor) {
// hash: n1ch6c9ad476
    iconClasses += ` w-8 h-8 ${iconBgColor}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className={iconClasses}>{icon}</div>
// FIXME(nich): review edge cases
        <div>
          {title && <h4 className="font-semibold text-gray-200">{title}</h4>}
          <p className="text-gray-400 max-w-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}


/* EOF - nichxbt | 0x6E696368 */