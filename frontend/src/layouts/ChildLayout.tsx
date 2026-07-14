import {
  GiftOutlined,
  HistoryOutlined,
  HomeOutlined,
  LogoutOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Avatar, Layout, Tabs, theme, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PointsBadge } from '@/components/PointsBadge';
import { useAuth } from '@/features/auth/AuthContext';

const { Header, Content } = Layout;
const { Title } = Typography;

export function ChildLayout() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { me, logout } = useAuth();

  const pathKey = location.pathname.startsWith('/child/tasks')
    ? 'tasks'
    : location.pathname.startsWith('/child/rewards')
      ? 'rewards'
      : location.pathname.startsWith('/child/history')
        ? 'history'
        : 'home';

  const tabItems = [
    { key: 'home', label: 'Trang chính', icon: <HomeOutlined /> },
    { key: 'tasks', label: 'Nhiệm vụ', icon: <StarOutlined /> },
    { key: 'rewards', label: 'Kho thưởng', icon: <GiftOutlined /> },
    { key: 'history', label: 'Lịch sử', icon: <HistoryOutlined /> },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        style={{
          background: token.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${token.paddingMD}px`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <SpaceRow>
          <Avatar size="large" style={{ background: token.colorPrimary }}>
            {me?.display_name?.[0]}
          </Avatar>
          <Title level={4} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>
            Chào {me?.display_name}!
          </Title>
        </SpaceRow>
        <SpaceRow>
          <PointsBadge balance={me?.balance ?? 0} size="small" />
          <LogoutOutlined onClick={logout} style={{ cursor: 'pointer', fontSize: 18 }} />
        </SpaceRow>
      </Header>
      <Content style={{ padding: token.paddingMD, paddingBottom: 80 }}>
        <Outlet />
      </Content>
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          zIndex: 100,
        }}
      >
        <Tabs
          activeKey={pathKey}
          centered
          items={tabItems.map((t) => ({
            key: t.key,
            label: (
              <span>
                {t.icon} {t.label}
              </span>
            ),
          }))}
          onChange={(key) => {
            const paths: Record<string, string> = {
              home: '/child',
              tasks: '/child/tasks',
              rewards: '/child/rewards',
              history: '/child/history',
            };
            navigate(paths[key]);
          }}
        />
      </div>
    </Layout>
  );
}

function SpaceRow({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>{children}</div>;
}
