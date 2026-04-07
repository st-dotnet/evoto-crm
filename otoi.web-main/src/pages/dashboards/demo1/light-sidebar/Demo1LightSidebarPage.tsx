import { Fragment } from 'react';
import { Container } from '@/components/container';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import { Demo1LightSidebarContent } from './';

const Demo1LightSidebarPage = () => {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading title="Dashboard" description="Central Hub for business overview" />
        </Toolbar>
      </Container>

      <Container>
        <Demo1LightSidebarContent />
      </Container>
    </Fragment>
  );
};

export { Demo1LightSidebarPage };
