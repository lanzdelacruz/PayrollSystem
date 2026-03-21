package com.reddamien.payroll;

import java.math.BigDecimal;
import java.util.Date;

public class CashAdvance {
    private int id;
    private int employeeId;
    private Date advanceDate;
    private BigDecimal amount;
    private String reason;
    private String status;

    // Getters and Setters
    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public int getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(int employeeId) {
        this.employeeId = employeeId;
    }

    public Date getAdvanceDate() {
        return advanceDate;
    }

    public void setAdvanceDate(Date advanceDate) {
        this.advanceDate = advanceDate;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
