import {
  CheckSquareOutlined,
  GiftOutlined,
  HomeOutlined,
  LogoutOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { Badge, Layout, Menu, theme, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, type Assignment, type Redemption } from '@/api/client';
import { useAuth } from '@/features/auth/AuthContext';

const { Sider, Content, Header } = Layout;
const { Title } = Typography;

export function ParentLayout() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const { data: submitted = [] } = useQuery({
    queryKey: ['assignments', 'submitted'],
    queryFn: () => api.get<Assignment[]>('/assignments?status=submitted'),
  });
  const { data: requested = [] } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<Redemption[]>('/redemptions?status=requested'),
  });

  const selectedKey = location.pathname.split('/')[2] || 'dashboard';

  const items = [
    { key: 'dashboard', icon: <HomeOutlined />, label: 'Tổng quan', onClick: () => navigate('/parent') },
    { key: 'tasks', icon: <CheckSquareOutlined />, label: 'Nhiệm vụ', onClick: () => navigate('/parent/tasks') },
    { key: 'rewards', icon: <GiftOutlined />, label: 'Phần thưởng', onClick: () => navigate('/parent/rewards') },
    {
      key: 'approvals',
      icon: <Badge count={submitted.length} size="small"><TrophyOutlined /></Badge>,
      label: 'Duyệt hoàn thành',
      onClick: () => navigate('/parent/approvals'),
    },
    {
      key: 'redemptions',
      icon: <Badge count={requested.length} size="small"><GiftOutlined /></Badge>,
      label: 'Duyệt đổi thưởng',
      onClick: () => navigate('/parent/redemptions'),
    },
    { key: 'children', icon: <TeamOutlined />, label: 'Con & Sổ điểm', onClick: () => navigate('/parent/children') },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0} style={{ background: token.colorBgContainer }}>
        <div style={{ padding: token.paddingLG, textAlign: 'center' }}>
          <Title level={4} style={{ margin: 0, color: token.colorPrimary, fontFamily: '"Baloo 2", cursive' }}>
            Bé Ngoan
          </Title>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgContainer, padding: `0 ${token.paddingLG}px` }}>
          <Title level={5} style={{ margin: 0 }}>Khu vực Bố Mẹ</Title>
        </Header>
        <Content style={{ margin: token.marginLG, padding: token.paddingLG, background: token.colorBgContainer, borderRadius: token.borderRadiusLG }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
