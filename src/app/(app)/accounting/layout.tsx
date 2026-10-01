import { AccountingNav } from "./sub-nav";

export default function AccountingLayout({ children }: LayoutProps<"/accounting">) {
  return (
    <>
      <div className="pt-3">
        <AccountingNav />
      </div>
      {children}
    </>
  );
}
