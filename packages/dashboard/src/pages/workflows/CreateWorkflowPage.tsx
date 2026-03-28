import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { createWorkflow } from '../../api/workflows';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { WorkflowStep } from '../../types';

type FormStep = Omit<WorkflowStep, 'type'>;

interface FormData {
  name: string;
  steps: FormStep[];
}

export function CreateWorkflowPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: '',
      steps: [{ name: '', activity: '', retries: 3, timeoutMs: 30000, compensation: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'steps' });

  const onSubmit = async (data: FormData) => {
    setError('');
    setSaving(true);
    try {
      const steps: WorkflowStep[] = data.steps.map((s) => ({
        name: s.name,
        type: 'activity' as const,
        activity: s.activity,
        retries: Number(s.retries),
        timeoutMs: Number(s.timeoutMs),
        compensation: s.compensation || null,
      }));
      const wf = await createWorkflow({ name: data.name, steps });
      toast.success('Workflow created', { description: wf.name });
      navigate(`/workflows/${wf.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create workflow';
      setError(msg);
      toast.error('Failed to create workflow', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-4">
        <Link to="/workflows" className="hover:text-brand-600">Workflows</Link> / New Workflow
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Card>
          <CardHeader>Workflow Details</CardHeader>
          <CardBody>
            <Input
              label="Workflow Name"
              placeholder="e.g. order-fulfillment"
              error={errors.name?.message}
              {...register('name', { required: 'Name is required' })}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Steps</CardHeader>
          <CardBody className="flex flex-col gap-4">
            {fields.map((field, i) => (
              <div key={field.id} className="border border-gray-200 rounded p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Step {i + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors">
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Name" placeholder="charge-card" {...register(`steps.${i}.name`, { required: true })} />
                  <Input label="Activity" placeholder="chargeCard" {...register(`steps.${i}.activity`, { required: true })} />
                  <Input label="Retries" type="number" min={0} {...register(`steps.${i}.retries`)} />
                  <Input label="Timeout (ms)" type="number" min={1000} {...register(`steps.${i}.timeoutMs`)} />
                  <Input
                    label="Compensation (optional)"
                    placeholder="refund-card"
                    className="col-span-2"
                    {...register(`steps.${i}.compensation`)}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ name: '', activity: '', retries: 3, timeoutMs: 30000, compensation: '' })}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 transition-colors font-medium"
            >
              <Plus size={14} /> Add Step
            </button>
          </CardBody>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Link to="/workflows"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit" loading={saving}>Create Workflow</Button>
        </div>
      </form>
    </div>
  );
}
