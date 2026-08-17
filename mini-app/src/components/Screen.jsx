import Header from './Header';
import BottomNav from './BottomNav';

export default function Screen({ title, withNav = true, withHeader = true, children }) {
  return (
    <div className="screen">
      {withHeader && <Header title={title} />}
      <main className={'screen__content' + (withNav ? ' screen__content--with-nav' : '')}>
        {children}
      </main>
      {withNav && <BottomNav />}
    </div>
  );
}
