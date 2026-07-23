import {
  GiftOutlined,
  HistoryOutlined,
  HomeOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Layout, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChildAvatar } from '@/components/CuteBits';
import { PointsBadge } from '@/components/PointsBadge';
import { useAuth } from '@/features/auth/AuthContext';
import { useProgression } from '@/features/progression/queries';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';

const { Header, Content } = Layout;
const { Title } = Typography;

export function ChildLayout() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { me, logout } = useAuth();
  const { t } = useTranslation();
  const { data: progression } = useProgression(me?.child_id);

  const pathKey = location.pathname.startsWith('/child/journey')
    ? 'journey'
    : location.pathname.startsWith('/child/tasks')
      ? 'tasks'
      : location.pathname.startsWith('/child/rewards')
        ? 'rewards'
        : location.pathname.startsWith('/child/games')
          ? 'games'
          : location.pathname.startsWith('/child/history')
            ? 'history'
            : 'home';

  const tabItems = [
    { key: 'home', label: t('childNav.home'), icon: <HomeOutlined />, path: '/child' },
    { key: 'journey', label: t('childNav.journey'), icon: <RocketOutlined />, path: '/child/journey' },
    { key: 'tasks', label: t('childNav.tasks'), icon: <StarOutlined />, path: '/child/tasks' },
    { key: 'rewards', label: t('childNav.rewards'), icon: <GiftOutlined />, path: '/child/rewards' },
    { key: 'games', label: t('childNav.games'), icon: <PlayCircleOutlined />, path: '/child/games' },
    { key: 'history', label: t('childNav.history'), icon: <HistoryOutlined />, path: '/child/history' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        className="bn-gradient-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${token.paddingMD}px`,
          height: 72,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 4px 16px -8px rgba(124,92,252,0.6)',
        }}
      >
        <SpaceRow>
          <ChildAvatar name={me?.display_name} gender={me?.gender} size={46} float />
          <Title level={4} style={{ margin: 0, color: '#fff', fontFamily: '"Baloo 2", cursive' }}>
            {t('greeting', { name: me?.display_name })}
          </Title>
        </SpaceRow>
        <SpaceRow>
          <LanguageSwitcher variant="onDark" />
          {progression && (
            <div
              onClick={() => navigate('/child/journey')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <span
                title={progression.level.title}
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  color: '#fff',
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                {progression.level.icon} {t('childNav.levelChip', { level: progression.level.level })}
              </span>
              {progression.streak.current > 0 && (
                <span
                  style={{
                    background: 'rgba(255,255,255,0.22)',
                    color: '#fff',
                    borderRadius: 999,
                    padding: '3px 10px',
                    fontWeight: 700,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                  }}
                >
                  🔥 {progression.streak.current}
                </span>
              )}
            </div>
          )}
          <div
            style={{
              background: '#fff',
              borderRadius: 999,
              padding: '2px 14px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PointsBadge balance={me?.balance ?? 0} size="small" />
          </div>
          <LogoutOutlined onClick={logout} style={{ cursor: 'pointer', fontSize: 18, color: '#fff' }} />
        </SpaceRow>
      </Header>
      <Content style={{ padding: token.paddingMD, paddingBottom: 88 }}>
        <div className="bn-fade-up">
          <Outlet />
        </div>
      </Content>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -6px 20px -10px rgba(124,92,252,0.4)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}
      >
        {tabItems.map((t) => {
          const active = pathKey === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(t.path)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 4px 12px',
                color: active ? token.colorPrimary : token.colorTextSecondary,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  lineHeight: 1,
                  padding: '5px 18px',
                  borderRadius: 999,
                  background: active ? token.colorPrimaryBg : 'transparent',
                  transition: 'background 0.2s ease',
                }}
              >
                {t.icon}
              </span>
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </Layout>
  );
}

function SpaceRow({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>{children}</div>;
}
