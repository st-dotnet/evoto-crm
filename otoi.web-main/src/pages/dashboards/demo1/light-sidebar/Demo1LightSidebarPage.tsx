import { Fragment } from 'react';
import { Container } from '@/components/container';
import { Toolbar, ToolbarHeading } from '@/layouts/demo1/toolbar';
import { Demo1LightSidebarContent } from './';

const Demo1LightSidebarPage = () => {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading title="Dashboard" />
        </Toolbar>
      </Container>

      <Container>
        <div className="mt-5 lg:mt-8">
          <Demo1LightSidebarContent />
        </div>
      </Container>
    </Fragment>
  );
};

export { Demo1LightSidebarPage };
