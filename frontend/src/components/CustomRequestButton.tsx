import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const handleOk = async () => {
    const value = text.trim();
    if (!value) {
      message.warning(t('components:customRequest.emptyWarning'));
      return;
    }
    await onSubmit(value);
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
        okText={t('components:customRequest.submit')}
        cancelText={t('action.cancel')}
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
