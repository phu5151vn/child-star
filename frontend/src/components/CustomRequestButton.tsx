import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, message } from 'antd';

interface CustomRequestButtonProps {
  label: string;
  modalTitle: string;
  placeholder: string;
  onSubmit: (title: string) => Promise<unknown>;
  submitting?: boolean;
}

/** Nút mở modal để con nhập một yêu cầu tự do (phần thưởng / nhiệm vụ ngoài danh sách). */
export function CustomRequestButton({
  label,
  modalTitle,
  placeholder,
  onSubmit,
  submitting,
}: CustomRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const handleOk = async () => {
    const t = text.trim();
    if (!t) {
      message.warning('Con hãy nhập nội dung nhé');
      return;
    }
    await onSubmit(t);
    setText('');
    setOpen(false);
  };

  return (
    <>
      <Button type="dashed" icon={<PlusOutlined />} shape="round" block onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        title={modalTitle}
        open={open}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        okText="Gửi cho bố mẹ"
        cancelText="Hủy"
        confirmLoading={submitting}
      >
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoSize={{ minRows: 2, maxRows: 4 }}
          maxLength={120}
          showCount
          autoFocus
        />
      </Modal>
    </>
  );
}
