import { EditOutlined, GiftOutlined, TrophyOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, InputNumber, Modal, Row, Space, Statistic, Switch, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Assignment, type Redemption, type WeeklyGoal } from '@/api/client';
import { EmojiIcon } from '@/components/CuteBits';
import { PageState } from '@/components/PageState';

const { Title, Text } = Typography;

export function ParentDashboardPage() {
  const qc = useQueryClient();
  const [goalOpen, setGoalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: submitted, isLoading: l1, isError: e1, refetch: r1 } = useQuery({
    queryKey: ['assignments', 'submitted'],
    queryFn: () => api.get<Assignment[]>('/assignments?status=submitted'),
  });
  const { data: requested, isLoading: l2, isError: e2, refetch: r2 } = useQuery({
    queryKey: ['redemptions', 'requested'],
    queryFn: () => api.get<Redemption[]>('/redemptions?status=requested'),
  });
  const { data: family } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.get<{ family_code: string }>('/family'),
  });
  const { data: goal } = useQuery({
    queryKey: ['weekly-goal'],
    queryFn: () => api.get<WeeklyGoal>('/weekly-goal'),
  });

  const saveGoal = useMutation({
    mutationFn: (values: { target_count: number; bonus_points: number; is_active: boolean }) =>
      api.put('/weekly-goal', values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['weekly-goal'] });
      setGoalOpen(false);
      message.success('Đã lưu mục tiêu tuần');
    },
    onError: (e: Error) => message.error(e.message),
  });

  const openGoal = () => {
    form.setFieldsValue({
      target_count: goal?.target_count ?? 5,
      bonus_points: goal?.bonus_points ?? 30,
      is_active: goal?.is_active ?? true,
    });
    setGoalOpen(true);
  };

  const stats = [
    { title: 'Chờ duyệt hoàn thành', value: submitted?.length ?? 0, emoji: '📝', color: '#7c5cfc' },
    { title: 'Chờ duyệt đổi thưởng', value: requested?.length ?? 0, emoji: '🎁', color: '#ff8fc7' },
    { title: 'Mã gia đình', value: family?.family_code ?? '—', emoji: '🏠', color: '#3dd598', isText: true },
  ];

  return (
    <PageState isLoading={l1 || l2} isError={e1 || e2} onRetry={() => { void r1(); void r2(); }}>
      <Title level={3} style={{ marginTop: 0 }}>🏡 Tổng quan gia đình</Title>

      <Row gutter={[16, 16]} className="bn-stagger" style={{ marginTop: 16 }}>
        {stats.map((s) => (
          <Col xs={24} sm={8} key={s.title}>
            <Card className="bn-card-hover" style={{ borderRadius: 24 }}>
              <Space align="center" size="middle">
                <EmojiIcon emoji={s.emoji} size={52} />
                <Statistic
                  title={s.title}
                  value={s.value}
                  valueStyle={{ color: s.color, fontWeight: 700, fontSize: s.isText ? 26 : 32 }}
                />
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        className="bn-card-hover"
        style={{ borderRadius: 24, marginTop: 16 }}
        title={<span><TrophyOutlined style={{ color: '#ffc531' }} /> Mục tiêu nhiệm vụ tuần</span>}
        extra={<Button shape="round" icon={<EditOutlined />} onClick={openGoal}>Chỉnh sửa</Button>}
      >
        {goal?.is_active && goal.target_count ? (
          <Space direction="vertical" size={4}>
            <Text style={{ fontSize: 16 }}>
              Hoàn thành <b>{goal.target_count}</b> nhiệm vụ / tuần để nhận
              <b style={{ color: '#7c5cfc' }}> +{goal.bonus_points} sao</b> thưởng 🎉
            </Text>
            <Text type="secondary">Bonus được tự động cộng cho mỗi con ngay khi đạt mục tiêu trong tuần.</Text>
          </Space>
        ) : (
          <Space direction="vertical">
            <Text type="secondary">Chưa bật mục tiêu tuần. Hãy đặt mục tiêu để khích lệ các con nhé!</Text>
            <Button type="primary" shape="round" icon={<GiftOutlined />} onClick={openGoal}>
              Đặt mục tiêu tuần
            </Button>
          </Space>
        )}
      </Card>

      <Modal title="🎯 Mục tiêu nhiệm vụ tuần" open={goalOpen} onCancel={() => setGoalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={(v) => saveGoal.mutate(v)} style={{ marginTop: 12 }}>
          <Form.Item
            name="target_count"
            label="Số nhiệm vụ cần hoàn thành / tuần"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="bonus_points"
            label="Điểm thưởng bonus (sao)"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Bật mục tiêu tuần" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" shape="round" htmlType="submit" loading={saveGoal.isPending}>
            Lưu mục tiêu
          </Button>
        </Form>
      </Modal>
    </PageState>
  );
}
