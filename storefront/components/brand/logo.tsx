import { cn } from "@/lib/utils";

/**
 * The Gadgets Garden mark — the real one, from
 * `public/gadgetsgardenlogo.svg`.
 *
 * Inlined as a component rather than loaded through `next/image` so it scales
 * with `currentColor`-free crispness at any size, costs no extra request, and
 * can appear twice on a page without duplicate-id problems.
 *
 * COLOURS ARE FIXED, not themed. This is a brand mark: it is the same object on
 * the white catalogue and the black hero. Both readings have been checked — the
 * indigo and teal hold contrast against white and black alike.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 317 336"
      fill="none"
      role="img"
      aria-label="Gadgets Garden"
      className={cn("size-8", className)}
    >
      <g transform="translate(-993.467 -1510.44)">
        <g transform="translate(923 1493)">
          <path
            d="M305.333,164.39C317.193,158.783 338.955,147.006 364.173,172.794C373.692,182.528 383.095,208.416 376.122,241.41C366.331,287.736 319.479,326.857 283.588,341.72C270.461,347.156 239.918,357.085 245.987,351.826C262.001,337.948 259.306,335.671 269.786,324.867C294.148,322.187 367.341,243.485 332.221,183.68C321.922,166.141 309.965,167.233 305.333,164.39Z"
            fill="#626BEC"
          />
          <path
            d="M304.533,167.764C306.152,168.161 307.834,168.268 309.453,168.665C339.289,175.988 354.563,234.681 312.024,288.156C296.68,307.446 272.691,322.109 270.49,322.501C292.88,284.452 299.09,256.855 299.22,256.415C301.084,247.824 309.674,224.554 291.045,197.855C286.772,191.732 288.162,185.783 300.007,170.072C302.1,168.327 301.861,167.879 304.533,167.764Z"
            fill="#5ACBD1"
          />
          <g transform="translate(-923 -1493)">
            <path
              d="M1121.261,1709.696C1109.397,1692.987 1113.313,1682.497 1116.066,1672.31C1117.079,1670.286 1124.086,1656.292 1135.679,1651.918C1138.056,1651.021 1153.418,1645.225 1167.428,1652.635C1215.45,1678.038 1166.325,1756.311 1121.261,1709.696Z"
              fill="#71C5DF"
            />
          </g>
          <g transform="translate(-923 -1493)">
            <path
              d="M1096.441,1588.407C1182.089,1536.335 1221.829,1589.358 1282.341,1550.244C1295.337,1541.844 1301.86,1533.413 1307.712,1526.214C1308.478,1527.721 1306.817,1610.213 1247.423,1625.192C1187.739,1640.244 1148.209,1598.545 1106.662,1636.675C1087.18,1654.555 1084.211,1682.148 1083.742,1686.511C1086.844,1762.611 1158.488,1763.333 1189.562,1737.628C1201.887,1727.432 1158.2,1807.07 1086.65,1776.115C1055.775,1762.758 1044.85,1733.47 1043.047,1728.638C1035.465,1700.61 1035.548,1688.235 1043.296,1657.434C1048.289,1643.937 1048.087,1643.971 1055.035,1631.248C1065.965,1613.261 1071.966,1608.387 1082.206,1599.144L1086.489,1595.485L1096.441,1588.407Z"
              fill="#6ECED3"
            />
          </g>
          <g transform="translate(-923 -1493)">
            <path
              d="M1189.788,1748.427C1186.21,1759.236 1182.189,1781.566 1157.16,1803.091C1116.786,1837.813 1001.206,1815.006 993.759,1696.485C989.368,1626.591 1033.317,1511.235 1206.469,1525.904C1302.53,1534.042 1299.824,1515.176 1308.596,1510.684C1312.885,1508.487 1306.958,1521.82 1306.395,1523.459C1264.944,1581.081 1201.649,1557.301 1163.52,1561.663C1003.894,1579.923 996.127,1787.82 1123.494,1786.318C1165.253,1785.825 1185.37,1752.415 1188.5,1747.216C1189.544,1747.388 1189.525,1747.375 1189.788,1748.427Z"
              fill="#5E6FED"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * Mark plus wordmark. `GADGETS GARDEN` is set in wide tracking to match the
 * brand's own lockup; the tagline sits beneath it in the logo's teal.
 *
 * The wordmark uses `currentColor`, so it inverts with its surface while the
 * mark stays constant — which is how the brand actually appears on its own
 * material.
 */
export function Logo({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-[0.14em] uppercase">
          Gadgets Garden
        </span>
        {showTagline && (
          <span className="text-gg-cyan mt-1 text-[9px] font-medium tracking-[0.22em] uppercase">
            Quality. Trust. Performance.
          </span>
        )}
      </span>
    </span>
  );
}
