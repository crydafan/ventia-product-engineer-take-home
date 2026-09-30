import Image from "next/image";

export function VentiaLogo() {
  return <Image src="/images/logo-ventia-sidebar.png" alt="VentIA" width={132} height={40}
    className="h-10 w-[132px] object-contain" priority />;
}
