sed -i '/- name: Check Backend/i \      - name: Build Frontend First for Cargo\n        run: |\n          cd frontend\n          npm install\n          npm run build' .github/workflows/ci.yml
sed -i 's/- name: Build Frontend/- name: Build Frontend (Verify)/g' .github/workflows/ci.yml
