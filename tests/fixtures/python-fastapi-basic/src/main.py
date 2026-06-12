from fastapi import FastAPI, APIRouter, Depends

app = FastAPI()
router = APIRouter()

def get_current_user():
    return {"id": 1, "name": "admin"}

# 1. app.get path template
@app.get("/refunds/{refund_id}")
def get_refund(refund_id: str):
    pass

# 2. app.post static route
@app.post("/refunds")
def create_refund():
    pass

# 3. router.get without prefix
@router.get("/bookings")
def get_bookings():
    pass

# 5. f-string dynamic route unsupported
dynamic = "status"
@app.get(f"/refunds/{dynamic}")
def dynamic_refund_status():
    pass

# 6. Depends boundary with route still extracted
@app.delete("/refunds/{refund_id}")
def delete_refund(refund_id: str, user = Depends(get_current_user)):
    pass
