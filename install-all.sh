#!/bin/bash
# Install dependencies for shared folder and all services
echo "Installing shared dependencies..."
cd shared && npm install && cd ..

echo "Installing service dependencies..."
for service in services/*/; do
  echo "Installing dependencies for $service"
  cd "$service" && npm install && cd ../../
done

echo "✓ All dependencies installed!"
