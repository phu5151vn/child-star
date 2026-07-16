import { useState } from 'react';
import {
  CheckSquareOutlined,
  GiftOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  PlayCircleOutlined,
  TeamOutlined,
  TrophyOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { Badge, Button, Drawer, Grid, Layout, Menu, theme, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, type Assignment, type Redemption } from '@/api/client';
import { useAuth } from '@/features/auth/AuthContext';

const { Sider, Content, Header } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const SIDER_WIDTH = 224;

export function ParentLayout() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, me } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: submitted = [] } = useQuery({
    queryKey: ['assignments', 'submitted'],
    queryFn: () => api.get<Assignment[]>('/assignments?status=submitted'),
  });
  const { data: requested = [] } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<Redemption[]>('/redemptions?status=requested'),
  });

  const selectedKey = location.pathname.split('/')[2] || 'dashboard';

  const go = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const items = [
    { key: 'dashboard', icon: <HomeOutlined />, label: 'Tổng quan', onClick: () => go('/parent') },
    { key: 'tasks', icon: <CheckSquareOutlined />, label: 'Nhiệm vụ', onClick: () => go('/parent/tasks') },
    { key: 'rewards', icon: <GiftOutlined />, label: 'Phần thưởng', onClick: () => go('/parent/rewards') },
    {
      key: 'approvals',
      icon: <Badge count={submitted.length} size="small"><TrophyOutlined /></Badge>,
      label: 'Duyệt hoàn thành',
      onClick: () => go('/parent/approvals'),
    },
    {
      key: 'redemptions',
      icon: <Badge count={requested.length} size="small"><GiftOutlined /></Badge>,
      label: 'Duyệt đổi thưởng',
      onClick: () => go('/parent/redemptions'),
    },
    { key: 'children', icon: <TeamOutlined />, label: 'Con & Sổ điểm', onClick: () => go('/parent/children') },
    ...(me?.can_manage_members
      ? [{ key: 'relatives', icon: <UsergroupAddOutlined />, label: 'Người thân', onClick: () => go('/parent/relatives') }]
      : []),
    { key: 'games', icon: <PlayCircleOutlined />, label: 'Trò chơi', onClick: () => go('/parent/games') },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout },
  ];

  const brand = (
    <div style={{ padding: `${token.paddingLG}px ${token.paddingLG}px ${token.paddingSM}px`, textAlign: 'center' }}>
      <div className="bn-float" style={{ fontSize: 34, lineHeight: 1 }}>⭐</div>
      <Title level={4} style={{ margin: '6px 0 0', color: token.colorPrimary, fontFamily: '"Baloo 2", cursive' }}>
        Bé Ngoan
      </Title>
      <Text type="secondary" style={{ fontSize: 12 }}>Tích sao • Đổi thưởng</Text>
    </div>
  );

  const menu = <Menu mode="inline" selectedKeys={[selectedKey]} items={items} style={{ border: 'none', background: 'transparent' }} />;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          width={SIDER_WIDTH}
          style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'auto',
          }}
        >
          {brand}
          {menu}
        </Sider>
      )}

      <Drawer
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={SIDER_WIDTH}
        styles={{ body: { padding: 0 } }}
        closable={false}
      >
        {brand}
        {menu}
      </Drawer>

      <Layout>
        <Header
          className="bn-gradient-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: `0 ${token.paddingLG}px`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            boxShadow: '0 4px 16px -8px rgba(124,92,252,0.6)',
          }}
        >
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở menu"
            />
          )}
          <span style={{ fontSize: 22 }}>👨‍👩‍👧‍👦</span>
          <Title level={5} style={{ margin: 0, color: '#fff' }}>Khu vực Bố Mẹ</Title>
        </Header>
        <Content
          style={{
            margin: isMobile ? token.marginSM : token.marginLG,
            padding: isMobile ? token.padding : token.paddingLG,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minWidth: 0,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
